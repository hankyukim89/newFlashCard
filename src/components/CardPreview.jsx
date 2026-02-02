import React, { useRef } from 'react';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from '../contexts/AuthContext';

const CardPreview = ({ card, index, onUpdate, onAddImage, onDelete, images }) => {
    const fileInputRef = useRef(null);
    const currentImageSide = useRef(null);
    const { user } = useAuth();
    const [uploading, setUploading] = React.useState(false);

    const handleImageClick = (side) => {
        currentImageSide.current = side;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file && currentImageSide.current && user) {
            setUploading(true);
            try {
                // Create a unique path: users/{userId}/images/{timestamp}_{filename}
                const storageRef = ref(storage, `users/${user.id}/images/${Date.now()}_${file.name}`);

                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);

                onAddImage(index, currentImageSide.current, url);
            } catch (error) {
                console.error("Upload failed", error);
                alert("Image upload failed");
            } finally {
                setUploading(false);
                e.target.value = ''; // Reset
            }
        }
    };

    const termImage = images?.[index]?.term;
    const defImage = images?.[index]?.definition;

    return (
        <div className="card-preview">
            <div className="card-header">
                <span>{index + 1}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="delete-btn" onClick={() => onDelete(index)} title="Delete card">
                        🗑️
                    </button>
                    {uploading && <span style={{ fontSize: '0.8rem', color: '#666' }}>Uploading...</span>}
                </div>
            </div>

            <div className="card-row">
                <div className="preview-input-group">
                    <label>Term</label>
                    <input
                        className="preview-input"
                        value={card.term}
                        onChange={(e) => onUpdate(index, 'term', e.target.value)}
                        placeholder="Term"
                    />
                </div>
                <button
                    className="image-upload-btn"
                    onClick={() => handleImageClick('term')}
                    style={termImage ? { backgroundImage: `url(${termImage})`, backgroundSize: 'cover', border: 'none' } : {}}
                >
                    {!termImage && <span>Image</span>}
                </button>
            </div>

            <div className="card-row">
                <div className="preview-input-group">
                    <label>Definition</label>
                    <input
                        className="preview-input"
                        value={card.definition}
                        onChange={(e) => onUpdate(index, 'definition', e.target.value)}
                        placeholder="Definition"
                    />
                </div>
                <button
                    className="image-upload-btn"
                    onClick={() => handleImageClick('definition')}
                    style={defImage ? { backgroundImage: `url(${defImage})`, backgroundSize: 'cover', border: 'none' } : {}}
                >
                    {!defImage && <span>Image</span>}
                </button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
            />
        </div>
    );
};

export default CardPreview;
