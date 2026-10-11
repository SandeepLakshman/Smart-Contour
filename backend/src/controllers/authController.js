import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const AUTH_SECRET = process.env.AUTH_SECRET || "smartcontour-jwt-secret-key-2026-prototype";

// Default demo clinician
const DEFAULT_USER = {
  uid: "clinician-priya-01",
  email: "priya.sharma@smartcontour.demo",
  displayName: "Dr. Priya Sharma",
  role: "Demo Clinician",
  salt: "demo-salt-12345",
  hash: hashPassword("SmartContour2026!", "demo-salt-12345"),
  createdAt: new Date().toISOString(),
};

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function loadUsers() {
  const users = new Map();
  // Only inject demo clinician if explicitly enabled or in non-production development
  const isProd = process.env.NODE_ENV === "production";
  const allowDemo = process.env.ALLOW_DEMO_LOGIN === "true" || !isProd;
  if (allowDemo) {
    users.set(DEFAULT_USER.email.toLowerCase(), DEFAULT_USER);
  }

  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((u) => users.set(u.email.toLowerCase(), u));
      }
    }
  } catch (err) {
    console.warn("[Auth] Could not read users.json:", err.message);
  }
  return users;
}

function saveUsers(usersMap) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = [...usersMap.values()];
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.warn("[Auth] Error saving users.json:", err.message);
  }
}

// Minimal, secure signed token implementation
export function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${claims}`)
    .digest("base64url");
  return `${header}.${claims}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, claims, signature] = parts;
  const expected = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${claims}`)
    .digest("base64url");
  if (signature !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function register(req, res) {
  try {
    const { email, password, displayName, role } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = displayName ? String(displayName).trim() : cleanEmail.split("@")[0];
    const userRole = role ? String(role).trim() : "Clinician";

    // Attempt Firebase Admin auth creation if available
    let firebaseUid = null;
    try {
      if (admin.apps.length) {
        const fbUser = await admin.auth().createUser({
          email: cleanEmail,
          password: String(password),
          displayName: cleanName,
        });
        firebaseUid = fbUser.uid;
      }
    } catch (fbErr) {
      // If auth not enabled in GCP, fall back to durable local user store
      console.log("[Auth] Firebase Admin Auth notice (falling back to durable store):", fbErr.message);
    }

    const users = loadUsers();
    if (users.has(cleanEmail)) {
      return res.status(400).json({ success: false, error: "An account with this email already exists" });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(String(password), salt);
    const user = {
      uid: firebaseUid || `user-${crypto.randomBytes(8).toString("hex")}`,
      email: cleanEmail,
      displayName: cleanName,
      role: userRole,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };

    users.set(cleanEmail, user);
    saveUsers(users);

    // Persist user record to Cloud Firestore if connected
    if (admin.apps.length) {
      try {
        const db = admin.firestore();
        await db.collection("clinicians").doc(user.uid).set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          salt: user.salt,
          hash: user.hash,
          createdAt: user.createdAt,
        }, { merge: true });
      } catch (dbErr) {
        console.warn("[Auth] Cloud Firestore clinician save notice:", dbErr.message);
      }
    }

    const token = createToken({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      token,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, error: "Registration failed: " + err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const users = loadUsers();
    let user = users.get(cleanEmail);
    if (!user && admin.apps.length) {
      try {
        const snap = await admin.firestore().collection("clinicians").where("email", "==", cleanEmail).limit(1).get();
        if (!snap.empty) {
          user = snap.docs[0].data();
          users.set(cleanEmail, user);
        }
      } catch (fErr) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const checkHash = hashPassword(String(password), user.salt);
    if (checkHash !== user.hash) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const token = createToken({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });

    return res.json({
      success: true,
      message: "Authenticated successfully",
      token,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, error: "Login failed: " + err.message });
  }
}

export async function getMe(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
  return res.json({
    success: true,
    user: {
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
    },
  });
}

export async function logout(_req, res) {
  return res.json({ success: true, message: "Logged out" });
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required to access clinical records" });
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
  }
  req.user = payload;
  next();
}
