import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBlp7-zjPRnZRg9uLCqJNwZWCTpSYTENaI",
  authDomain: "lacoralina.firebaseapp.com",
  projectId: "lacoralina",
  storageBucket: "lacoralina.firebasestorage.app",
  messagingSenderId: "160457335380",
  appId: "1:160457335380:web:9ec435a8bae63c3cc943c1",
  measurementId: "G-9VRLX801NS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;