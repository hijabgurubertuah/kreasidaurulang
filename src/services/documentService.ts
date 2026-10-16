import { doc, collection, addDoc, updateDoc, deleteDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from './firebase'; // You'll need to set up firebase.ts to export db

export const saveDocument = async (judul: string, isi: string, id?: string) => {
  const data = {
    judul,
    isi,
    updatedAt: serverTimestamp(),
  };

  if (id) {
    await updateDoc(doc(db, 'dokumen', id), data);
    return id;
  } else {
    const docRef = await addDoc(collection(db, 'dokumen'), { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }
};

export const deleteDocument = async (id: string) => {
  await deleteDoc(doc(db, 'dokumen', id));
};

export const getDocuments = async () => {
  const q = query(collection(db, 'dokumen'), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
