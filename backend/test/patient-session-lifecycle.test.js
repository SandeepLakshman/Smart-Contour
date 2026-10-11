// test/patient-session-lifecycle.test.js
// Tests patient validation, duplicate check, session conflict, duration calculation, and sensor rejection on completed session.
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";

// We test controller logic directly with mock req/res
import * as patientController from "../src/controllers/patientController.js";
import * as sessionController from "../src/controllers/sessionController.js";
import * as sensorController from "../src/controllers/sensorController.js";

async function runTests() {
  console.log("Starting patient & session lifecycle unit tests...");

  const clinicianUid = `clinician-unit-test-${Date.now()}`;

  function createMockRes() {
    return {
      statusCode: 200,
      data: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.data = payload;
        return this;
      },
    };
  }

  // 1. Patient Validation: Name min 2 chars
  {
    const req = { user: { uid: clinicianUid }, body: { name: "A", age: 30 } };
    const res = createMockRes();
    await patientController.createPatient(req, res);
    assert.equal(res.statusCode, 400, "Should reject 1-character name");
    assert.match(res.data.error, /at least 2 characters/i);
    console.log("✓ Patient name min length validated");
  }

  // 2. Patient Validation: Age range (0 to 125)
  {
    const req = { user: { uid: clinicianUid }, body: { name: "Valid Name", age: 150 } };
    const res = createMockRes();
    await patientController.createPatient(req, res);
    assert.equal(res.statusCode, 400, "Should reject age > 125");
    assert.match(res.data.error, /between 0 and 125/i);

    const reqNeg = { user: { uid: clinicianUid }, body: { name: "Valid Name", age: -5 } };
    const resNeg = createMockRes();
    await patientController.createPatient(reqNeg, resNeg);
    assert.equal(resNeg.statusCode, 400, "Should reject negative age");
    console.log("✓ Patient age boundaries validated");
  }

  // 3. Patient Creation & Duplicate Warning
  let createdPatientId;
  {
    const req = { user: { uid: clinicianUid }, body: { name: "John Doe", age: 45, notes: "Fitting" } };
    const res = createMockRes();
    await patientController.createPatient(req, res);
    assert.equal(res.statusCode, 201, "Should create patient");
    assert.equal(res.data.patient.name, "John Doe");
    assert.equal(res.data.patient.clinicianId, clinicianUid);
    createdPatientId = res.data.patient.id;
    console.log("✓ Patient created with clinician UID ownership");

    // Attempt to create duplicate with extra spaces / case differences without confirmDuplicate
    const dupReq = { user: { uid: clinicianUid }, body: { name: "  john   doe  ", age: 45 } };
    const dupRes = createMockRes();
    await patientController.createPatient(dupReq, dupRes);
    assert.equal(dupRes.statusCode, 409, "Should return 409 on duplicate name");
    assert.equal(dupRes.data.isDuplicateWarning, true);
    console.log("✓ Duplicate patient triggers 409 duplicate warning");

    // Confirm duplicate
    const confirmReq = { user: { uid: clinicianUid }, body: { name: "  john   doe  ", age: 45, confirmDuplicate: true } };
    const confirmRes = createMockRes();
    await patientController.createPatient(confirmReq, confirmRes);
    assert.equal(confirmRes.statusCode, 201, "Should allow duplicate when explicitly confirmed");
    console.log("✓ Explicit duplicate confirmation succeeds");
  }

  // 4. Session Creation & Concurrency Prevention
  let activeSessionId;
  {
    const req = { user: { uid: clinicianUid }, body: { patientId: createdPatientId, deviceId: "esp32-01" } };
    const res = createMockRes();
    await sessionController.createSession(req, res);
    assert.equal(res.statusCode, 201, "Should create active session");
    assert.equal(res.data.session.status, "active");
    assert.equal(res.data.session.clinicianId, clinicianUid);
    activeSessionId = res.data.session.id;
    console.log("✓ Session created in active state");

    // Attempt second concurrent active session for same patient
    const conflictReq = { user: { uid: clinicianUid }, body: { patientId: createdPatientId, deviceId: "esp32-01" } };
    const conflictRes = createMockRes();
    await sessionController.createSession(conflictReq, conflictRes);
    assert.equal(conflictRes.statusCode, 409, "Should prevent concurrent active session for patient");
    assert.equal(conflictRes.data.isConflict, true);
    console.log("✓ Concurrent active session conflict prevented (409)");
  }

  // 5. Sensor Telemetry to Active Session (Unauthenticated ESP32 route)
  {
    const req = {
      body: {
        deviceId: "SMARTCONTOUR-001",
        sessionId: activeSessionId,
        patientId: createdPatientId,
        sensors: {
          sensor1: 24.5,
          sensor2: 28.1,
        },
      },
    };
    const res = createMockRes();
    await sensorController.ingestSensorData(req, res);
    assert.equal(res.statusCode, 200, "Should ingest telemetry for active session");
    console.log("✓ Telemetry ingestion succeeded for active session");
  }

  // 6. End Session Lifecycle & Duration Calculation
  {
    // Wait small tick to ensure duration > 0
    await new Promise((r) => setTimeout(r, 50));
    const req = { user: { uid: clinicianUid }, params: { id: activeSessionId } };
    const res = createMockRes();
    await sessionController.endSession(req, res);
    assert.equal(res.statusCode, 200, "Should end session");
    assert.equal(res.data.session.status, "completed");
    assert.ok(res.data.session.endTime, "Should have endTime set");
    assert.ok(res.data.session.durationMs >= 50, "Duration should be computed from timestamps");
    console.log(`✓ Session ended normally (status: completed, duration: ${res.data.session.durationMs}ms)`);
  }

  // 7. Sensor Rejection on Completed Session
  {
    const req = {
      body: {
        deviceId: "SMARTCONTOUR-001",
        sessionId: activeSessionId,
        patientId: createdPatientId,
        sensors: {
          sensor1: 18.0,
          sensor2: 19.5,
        },
      },
    };
    const res = createMockRes();
    await sensorController.ingestSensorData(req, res);
    assert.equal(res.statusCode, 409, "Must reject telemetry sent to completed session");
    assert.match(res.data.error, /has been completed/i);
    console.log("✓ Telemetry ingestion safely rejected for completed session");
  }

  // 8. Now patient can have a new active session
  let newSessionId;
  {
    const req = { user: { uid: clinicianUid }, body: { patientId: createdPatientId, deviceId: "esp32-01" } };
    const res = createMockRes();
    await sessionController.createSession(req, res);
    assert.equal(res.statusCode, 201, "Can start new session now that previous session is completed");
    newSessionId = res.data.session.id;
    console.log("✓ New session allowed after previous session ended");
  }

  // 9. Single active session presentation & activateSession switching
  {
    const req = { user: { uid: clinicianUid }, query: { patientId: createdPatientId } };
    const res = createMockRes();
    await sessionController.getSessions(req, res);
    assert.equal(res.statusCode, 200);
    const patientSessions = res.data.sessions.filter((s) => s.patientId === createdPatientId);
    const activeList = patientSessions.filter((s) => s.status === "active");
    assert.equal(activeList.length, 1, "Exactly one active session should be reported for patient");
    console.log("✓ getSessions enforces at most one active session per patient");

    // Activate the earlier session
    const actReq = { user: { uid: clinicianUid }, params: { id: activeSessionId } };
    const actRes = createMockRes();
    await sessionController.activateSession(actReq, actRes);
    assert.equal(actRes.statusCode, 200, "Should activate session");

    // Check sessions again
    const res2 = createMockRes();
    await sessionController.getSessions(req, res2);
    const updatedPatientSessions = res2.data.sessions.filter((s) => s.patientId === createdPatientId);
    const activeList2 = updatedPatientSessions.filter((s) => s.status === "active");
    assert.equal(activeList2.length, 1, "Exactly one active session remains after activation");
    assert.equal(activeList2[0].id, activeSessionId, "Earlier session is now the active one");
    console.log("✓ activateSession safely switched active session without creating duplicate active sessions");

    // 10. Requirement 1 & 4: Confirm Firestore/store actually persists completed status and endTime
    const { getSession, listReadings } = await import("../src/services/store.js");
    const persistedPrior = await getSession(newSessionId);
    assert.equal(persistedPrior.status, "completed", "Prior session status must be persisted as completed");
    assert.ok(persistedPrior.endTime, "Prior session must have persisted endTime");
    assert.ok(persistedPrior.durationMs >= 0, "Prior session must have persisted durationMs");
    console.log("✓ Requirement 1 & 4: Status and endTime are truthfully persisted in storage, not just cosmetic");

    // 11. Requirement 2: Verify all historical readings and both sessions are preserved
    const readingsForInitial = await listReadings({ sessionId: activeSessionId });
    assert.equal(readingsForInitial.length, 1, "Historical telemetry readings are preserved");
    const allStored = await sessionController.getSessions(req, createMockRes());
    const countForPatient = allStored.data.sessions.filter((s) => s.patientId === createdPatientId).length;
    assert.ok(countForPatient >= 2, "Both sessions are preserved in history");
    console.log("✓ Requirement 2: Both sessions and all historical readings preserved intact");

    // 12. Requirement 3: Concurrent create and activate race condition test
    // Fire 5 concurrent activate and create requests simultaneously
    const concurrentPromises = [
      sessionController.createSession(
        { user: { uid: clinicianUid }, body: { patientId: createdPatientId, deviceId: "esp32-01" } },
        createMockRes()
      ),
      sessionController.activateSession(
        { user: { uid: clinicianUid }, params: { id: newSessionId } },
        createMockRes()
      ),
      sessionController.activateSession(
        { user: { uid: clinicianUid }, params: { id: activeSessionId } },
        createMockRes()
      ),
    ];
    await Promise.all(concurrentPromises);

    // Verify invariant holds under concurrency: exactly ONE active session
    const resFinal = createMockRes();
    await sessionController.getSessions(req, resFinal);
    const finalPatientSessions = resFinal.data.sessions.filter((s) => s.patientId === createdPatientId);
    const finalActiveList = finalPatientSessions.filter((s) => s.status === "active");
    assert.equal(finalActiveList.length, 1, "Atomic invariant holds: strictly 1 active session under concurrent requests");
    console.log("✓ Requirement 3: Atomic serialization guarantees strictly 1 active session under concurrency");
  }

  console.log("\nALL PATIENT & SESSION LIFECYCLE TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
