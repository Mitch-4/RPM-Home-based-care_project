import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCmQAeUW6XVaafzO65lfuTir2_f9IXh-DU",
  authDomain: "remotedoc-a8b6d.firebaseapp.com",
  databaseURL: "https://remotedoc-a8b6d-default-rtdb.firebaseio.com",
  projectId: "remotedoc-a8b6d",
  storageBucket:"remotedoc-a8b6d.firebasestorage.app",
  messagingSenderId:"125722766316",
  appId: "1:125722766316:web:40c026fb4dc9ebbb71eec9"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
