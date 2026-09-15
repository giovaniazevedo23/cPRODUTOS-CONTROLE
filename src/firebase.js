import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAqSQVMTijY8my5gVW-mc2j0Vn52fGFgvs",
  authDomain: "controle-1bc41.firebaseapp.com",
  projectId: "controle-1bc41",
  storageBucket: "controle-1bc41.firebasestorage.app",
  messagingSenderId: "887559515949",
  appId: "1:887559515949:web:ebd1b0564bf17abeea6da4",
  measurementId: "G-LS0HCTZPFN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
