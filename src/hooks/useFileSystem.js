import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

const DEFAULT_ITEMS = {
    'root': { id: 'root', type: 'folder', name: 'Main', parentId: null, permissions: 'private' }
};

export const useFileSystem = (userId) => {
    const getStorageKey = (uid) => `flashcards_filesystem_${uid || 'local'}`;

    // Initialize state from local storage to avoid flashing empty
    const [items, setItems] = useState(() => {
        const key = getStorageKey(userId);
        const local = localStorage.getItem(key);
        if (local) {
            try {
                return JSON.parse(local);
            } catch (e) {
                console.error("Parse error", e);
            }
        }
        return DEFAULT_ITEMS;
    });
    const [clipboard, setClipboard] = useState(null);

    const isRemoteUpdate = useRef(false);

    // Load from Firestore (Sync)
    useEffect(() => {
        if (!userId) return;

        const unsub = onSnapshot(doc(db, "users", userId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data().fileSystem;
                if (data) {
                    // Update state AND local storage to keep them in sync
                    isRemoteUpdate.current = true;
                    setItems(data);
                    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
                }
            } else {
                setDoc(doc(db, "users", userId), { fileSystem: DEFAULT_ITEMS }, { merge: true });
                setItems(DEFAULT_ITEMS);
            }
        }, (error) => {
            console.error("Firestore sync error:", error);
        });

        return () => unsub();
    }, [userId]);

    // Save to LocalStorage AND Firestore
    useEffect(() => {
        const key = getStorageKey(userId);

        // 1. Always save to LocalStorage (Fast, Offline-proof)
        if (items !== DEFAULT_ITEMS) {
            localStorage.setItem(key, JSON.stringify(items));
        }

        // 2. Sync to Firestore if logged in
        if (userId && items !== DEFAULT_ITEMS) {
            // Prevent echoing back updates that just came from Firestore
            if (isRemoteUpdate.current) {
                isRemoteUpdate.current = false;
                return;
            }

            const save = async () => {
                try {
                    // Use updateDoc to replace the entire 'fileSystem' map.
                    // setDoc with { merge: true } would merge keys, preventing deletion of removed keys.
                    await updateDoc(doc(db, "users", userId), { fileSystem: items });
                } catch (e) {
                    if (e.code === 'not-found') {
                        await setDoc(doc(db, "users", userId), { fileSystem: items });
                    } else {
                        console.error("Error saving to Firestore: ", e);
                    }
                }
            };
            save();
        }
    }, [items, userId]);

    // Helper to get children of a folder
    const getChildren = useCallback((folderId) => {
        return Object.values(items).filter(item => item.parentId === folderId);
    }, [items]);

    const createItem = useCallback((type, name, parentId, content = null) => {
        console.log('Creating item:', type, name, parentId);
        const id = uuidv4();
        const newItem = {
            id,
            type, // 'folder' | 'set'
            name,
            parentId,
            content, // Flashcard Set Data
            permissions: 'private', // 'private' | 'link' | 'public'
            created: Date.now(),
            modified: Date.now()
        };

        setItems(prev => ({ ...prev, [id]: newItem }));
        return id;
    }, []);

    const deleteItems = useCallback((ids) => {
        console.log('Deleting items:', ids);
        setItems(prev => {
            const next = { ...prev };
            const toDelete = new Set(ids);

            // Recursive delete helper
            const deleteRecursive = (itemId) => {
                toDelete.add(itemId);
                const children = Object.values(prev).filter(i => i.parentId === itemId);
                children.forEach(c => deleteRecursive(c.id));
            };

            ids.forEach(id => deleteRecursive(id));

            toDelete.forEach(id => delete next[id]);
            return next;
        });
    }, []);

    const renameItem = useCallback((id, newName) => {
        console.log('Renaming item:', id, newName);
        setItems(prev => ({
            ...prev,
            [id]: { ...prev[id], name: newName, modified: Date.now() }
        }));
    }, []);

    const moveItems = useCallback((ids, targetFolderId) => {
        console.log('Moving items:', ids, 'to', targetFolderId);
        setItems(prev => {
            const next = { ...prev };
            ids.forEach(id => {
                if (next[id] && next[id].id !== 'root') {
                    // Prevent moving folder into its own child
                    // TODO: check for circular dependency
                    next[id] = { ...next[id], parentId: targetFolderId, modified: Date.now() };
                }
            });
            return next;
        });
    }, []);

    const updateSetContent = useCallback((id, content) => {
        console.log('Updating content for:', id);
        setItems(prev => ({
            ...prev,
            [id]: { ...prev[id], content, modified: Date.now() }
        }));
    }, []);

    const copyToClipboard = useCallback((ids, action) => {
        console.log('Clipboard:', action, ids);
        setClipboard({ action, itemIds: ids });
    }, []);

    const pasteFromClipboard = useCallback((targetFolderId) => {
        console.log('Pasting to:', targetFolderId);
        if (!clipboard) return;

        if (clipboard.action === 'cut') {
            moveItems(clipboard.itemIds, targetFolderId);
            setClipboard(null); // Clear after cut
        } else if (clipboard.action === 'copy') {
            // Deep copy logic
            setItems(prev => {
                const next = { ...prev };

                const copyRecursive = (itemId, newParentId) => {
                    const original = prev[itemId];
                    if (!original) return;

                    const newId = uuidv4();
                    const newItem = {
                        ...original,
                        id: newId,
                        parentId: newParentId,
                        name: original.name + (newParentId === original.parentId ? ' (Copy)' : ''), // avoid name collision if same folder
                        created: Date.now(),
                        modified: Date.now()
                    };
                    next[newId] = newItem;

                    // Copy children if folder
                    if (original.type === 'folder') {
                        const children = Object.values(prev).filter(i => i.parentId === itemId);
                        children.forEach(c => copyRecursive(c.id, newId));
                    }
                };

                clipboard.itemIds.forEach(id => copyRecursive(id, targetFolderId));
                return next;
            });
        }
    }, [clipboard, moveItems]);

    const updatePermissions = useCallback((id, permission) => {
        console.log('Updating permissions:', id, permission);
        setItems(prev => ({
            ...prev,
            [id]: { ...prev[id], permissions: permission }
        }));
    }, []);

    return {
        items,
        getChildren,
        createItem,
        deleteItems,
        renameItem,
        moveItems,
        updateSetContent,
        copyToClipboard,
        pasteFromClipboard,
        clipboard,
        updatePermissions
    };
};
