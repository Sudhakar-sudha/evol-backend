// config/firebase.js
import admin from "firebase-admin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

if (!admin.apps.length) {
  const serviceAccount = require("../serviceAccountKey.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

}

export default admin;