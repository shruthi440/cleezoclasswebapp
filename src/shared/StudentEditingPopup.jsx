import React, { useRef, useState, useEffect } from 'react';
import Modal from 'react-modal';
import { FaCamera, FaUpload, FaTrash, FaEye, FaCheck, FaSpinner, FaTimes } from 'react-icons/fa';
import { removeBackground } from '@imgly/background-removal';
import { Eye } from 'lucide-react';

Modal.setAppElement('#root');

const StudentEditingPopup = ({
  isOpen,
  editingId,
  userType,
  formData,
  onFieldChange,
  onClassChange,
  classOptions,
  getSectionsForClass,
  photoPreview,
  photoFile,
  onPhotoChange,
  onRemovePhoto,
  onCancel,
  onSubmit,
  isLoading,
}) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const openCamera = async () => {
    setCameraError('');
    setShowCameraModal(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      // Wait for modal to render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Unable to access camera. Please check permissions or use Upload Photo instead.');
      setShowCameraModal(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });

      closeCamera();

      await processImage(file);
    }, 'image/jpeg', 0.95);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCameraModal(false);
  };

  const detectWhiteBackground = (imageBlob) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Sample corners (top-left, top-right, bottom-left, bottom-right)
        const sampleSize = 10;
        const corners = [
          { x: 0, y: 0 }, // top-left
          { x: img.width - sampleSize, y: 0 }, // top-right
          { x: 0, y: img.height - sampleSize }, // bottom-left
          { x: img.width - sampleSize, y: img.height - sampleSize } // bottom-right
        ];

        let whiteCount = 0;
        const threshold = 240; // RGB threshold for "white"

        corners.forEach(corner => {
          const imageData = ctx.getImageData(corner.x, corner.y, sampleSize, sampleSize);
          const data = imageData.data;
          
          let cornerWhitePixels = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Check if pixel is close to white
            if (r > threshold && g > threshold && b > threshold) {
              cornerWhitePixels++;
            }
          }
          
          // If more than 80% of corner is white, count it
          if (cornerWhitePixels > (sampleSize * sampleSize * 0.8)) {
            whiteCount++;
          }
        });

        // If 3 or more corners are white, assume background is already white
        resolve(whiteCount >= 3);
      };
      
      img.src = URL.createObjectURL(imageBlob);
    });
  };

  const processImage = async (file) => {
    setProcessing(true);
    setProcessingStatus('🔍 Analyzing image...');

    try {
      const hasWhiteBackground = await detectWhiteBackground(file);

      let finalBlob;

      if (hasWhiteBackground) {
        setProcessingStatus('📐 Resizing image...');
        finalBlob = await resizeImage(file);
      } else {
        setProcessingStatus('🪄 Removing background...');
        const blobWithoutBg = await removeBackground(file, {
          output: { format: 'image/png', quality: 0.9 },
        });

        setProcessingStatus('🎨 Adding white background...');
        finalBlob = await addWhiteBackgroundAndResize(blobWithoutBg);
      }

      const processedFile = new File([finalBlob], 'photo.png', { type: 'image/png' });

      const syntheticEvent = {
        target: {
          files: [processedFile],
        },
      };

      onPhotoChange(syntheticEvent);

      setProcessingStatus('✅ Photo processed!');
      setTimeout(() => setProcessingStatus(''), 3000);
    } catch (error) {
      console.error('Error processing image:', error);
      setProcessingStatus('❌ Error. Using original photo.');

      const syntheticEvent = {
        target: {
          files: [file],
        },
      };
      onPhotoChange(syntheticEvent);
    } finally {
      setProcessing(false);
    }
  };

  const resizeImage = async (imageBlob) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetWidth = 413;
        const targetHeight = 531;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');

        const imgAspect = img.width / img.height;
        const canvasAspect = targetWidth / targetHeight;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
          drawWidth = targetWidth * 0.85;
          drawHeight = drawWidth / imgAspect;
          drawX = (targetWidth - drawWidth) / 2;
          drawY = (targetHeight - drawHeight) / 2;
        } else {
          drawHeight = targetHeight * 0.85;
          drawWidth = drawHeight * imgAspect;
          drawX = (targetWidth - drawWidth) / 2;
          drawY = (targetHeight - drawHeight) / 2;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        canvas.toBlob(
          (blob) => resolve(blob),
          'image/png',
          0.95
        );
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  };

  const addWhiteBackgroundAndResize = async (imageBlob) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetWidth = 413;
        const targetHeight = 531;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const imgAspect = img.width / img.height;
        const canvasAspect = targetWidth / targetHeight;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
          drawWidth = targetWidth * 0.85;
          drawHeight = drawWidth / imgAspect;
          drawX = (targetWidth - drawWidth) / 2;
          drawY = (targetHeight - drawHeight) / 2;
        } else {
          drawHeight = targetHeight * 0.85;
          drawWidth = drawHeight * imgAspect;
          drawX = (targetWidth - drawWidth) / 2;
          drawY = (targetHeight - drawHeight) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        canvas.toBlob(
          (blob) => resolve(blob),
          'image/png',
          0.95
        );
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    processImage(file);
  };

  const handleRemovePhoto = () => {
    setProcessingStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (onRemovePhoto) onRemovePhoto();
  };

  const styles = {
    cameraModal: {
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      content: {
        position: 'relative',
        backgroundColor: '#000',
        padding: '20px',
        borderRadius: '12px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        border: 'none',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      },
    },
    cameraVideo: {
      width: '100%',
      maxWidth: '640px',
      height: 'auto',
      borderRadius: '8px',
      backgroundColor: '#000',
    },
    cameraControls: {
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      marginTop: '20px',
    },
    cameraButton: {
      padding: '12px 24px',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s',
    },
    captureButton: {
      padding: '16px 32px',
      backgroundColor: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '50px',
      fontSize: '16px',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 4px 12px rgba(39, 174, 96, 0.4)',
    },
    closeButton: {
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      // backgroundColor: 'rgba(255, 255, 255, 0.2)',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      zIndex: 10,
    },
    photoOverlay: {
      position: 'absolute',
      inset: 0,
      // background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0,
      transition: '0.3s',
      cursor: 'pointer',
    },
    previewIconBtn: {
      border: 'none',
      background: '#fff',
      color: '#333',
      width: 42,
      height: 42,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
imagePreviewModal: {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '40%',
  height: '50%',
  background: 'rgba(0, 0, 0, 0.58)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  borderRadius: '12px',
},
    largePreviewImage: {
      maxWidth: '90%',
      maxHeight: '90%',
      borderRadius: '10px',
      // boxShadow: '0 0 20px rgba(255,255,255,0.3)',
    },
    editModal: {
      overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
      },
      content: {
        backgroundColor: '#fff',
        padding: '18px 22px 22px',
        borderRadius: '14px',
        width: '80vw',
        height: '80vh',
        overflowY: 'auto',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      },
    },
    editForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    },
    editFormHeader: {
      color: '#2c3e50',
      marginBottom: '20px',
      paddingBottom: '10px',
      borderBottom: '1px solid #3498db',
    },
    formSection: {
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '4px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    sectionHeader: {
      color: '#3498db',
      marginBottom: '15px',
      paddingBottom: '5px',
      borderBottom: '1px solid #ecf0f1',
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '15px',
    },
    formGroup: {
      marginBottom: '10px',
    },
    formLabel: {
      display: 'block',
      marginBottom: '5px',
      fontWeight: '500',
      color: '#34495e',
      fontSize: '14px',
    },
    formInput: {
      width: '93%',
      padding: '8px',
      border: '1px solid #bdc3c7',
      borderRadius: '4px',
      fontSize: '14px',
      boxSizing: 'border-box',
    },
    formActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
    },
    saveButton: {
      padding: '8px 20px',
      backgroundColor: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      opacity: isLoading ? 0.8 : 1,
    },
    cancelButton: {
      padding: '8px 20px',
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    },
    photoContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      flexWrap: 'wrap',
    },
    photoPreviewWrapper: {
      position: 'relative',
      width: 150,
      height: 150,
      borderRadius: '8px',
      overflow: 'hidden',
      border: '2px solid #ddd',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    photoPreview: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    photoPlaceholderLarge: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: '#f8fafc',
      color: '#94a3b8',
      fontSize: 13,
    },
    removePhotoBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'rgba(239, 68, 68, 0.9)',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
      zIndex: 5,
    },
    processingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    photoActions: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    },
    photoActionButton: {
      padding: '10px 16px',
      border: 'none',
      borderRadius: 6,
      color: '#fff',
      fontWeight: 600,
      width:"140px",
      fontSize: 13,
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer',
    },
    statusMessage: {
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    photoHint: {
      fontSize: 12,
      color: '#666',
      marginTop: '5px',
    },
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onCancel}
        contentLabel="Edit User"
        style={{
          overlay: styles.editModal.overlay,
          content: styles.editModal.content,
        }}
      >
        <form onSubmit={onSubmit} style={styles.editForm}>
          <h3 style={styles.editFormHeader}>
            {userType === 'teacher'
              ? 'Teacher'
              : userType === 'management'
                ? 'Management User'
                : 'Student'}{' '}
            Details (ID: {editingId || ''})
          </h3>

          <div style={styles.formSection}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Student ID</label>
                <input
                  type="text"
                  name="id"
                  value={String(editingId || '')}
                  readOnly
                  style={styles.formInput}
                />
              </div>
            </div>
          </div>

          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Student Photo</h4>

            <div style={styles.photoContainer}>
              <div style={styles.photoPreviewWrapper}>
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Student"
                      style={styles.photoPreview}
                    />

                    {/* Hover Overlay with Eye Icon */}
                    <div
                      style={styles.photoOverlay}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = 1;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = 0;
                      }}
                    >
                      <button
                        type="button"
                        style={styles.previewIconBtn}
                        onClick={() => setShowPhotoPreview(true)}
                      >
                        <Eye size={20} />
                      </button>
                    </div>

                    {processing && (
                      <div style={styles.processingOverlay}>
                        <FaSpinner size={24} className="spin-animation" color="#fff" />
                        <span style={{ color: '#fff', fontSize: 12, marginTop: 8 }}>
                          Processing...
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={styles.photoPlaceholderLarge}>
                    <FaCamera size={32} color="#cbd5e1" />
                    <span style={{ marginTop: 8 }}>No Photo</span>
                  </div>
                )}

                {photoPreview && !processing && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    style={styles.removePhotoBtn}
                    title="Remove photo"
                  >
                    <FaTrash size={12} />
                  </button>
                )}
              </div>

              <div style={styles.photoActions}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  style={{
                    ...styles.photoActionButton,
                    background: processing
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #3498db, #2980b9)',
                    cursor: processing ? 'not-allowed' : 'pointer',
                  }}
                >
                  <FaUpload size={14} />
                  <span>{photoFile ? 'Change Photo' : 'Upload Photo'}</span>
                </button>

                <button
                  type="button"
                  onClick={openCamera}
                  disabled={processing}
                  style={{
                    ...styles.photoActionButton,
                    background: processing
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #27ae60, #229954)',
                    cursor: processing ? 'not-allowed' : 'pointer',
                  }}
                >
                  <FaCamera size={14} />
                  <span>Click Photo</span>
                </button>

                {processingStatus && (
                  <div
                    style={{
                      ...styles.statusMessage,
                      background: processingStatus.includes('✅')
                        ? '#f0fdf4'
                        : processingStatus.includes('❌')
                          ? '#fef2f2'
                          : '#eff6ff',
                      color: processingStatus.includes('✅')
                        ? '#166534'
                        : processingStatus.includes('❌')
                          ? '#991b1b'
                          : '#1e40af',
                      border: processingStatus.includes('✅')
                        ? '1px solid #bbf7d0'
                        : processingStatus.includes('❌')
                          ? '1px solid #fecaca'
                          : '1px solid #bfdbfe',
                    }}
                  >
                    {processingStatus.includes('✅') && <FaCheck size={12} />}
                    <span>{processingStatus}</span>
                  </div>
                )}

                <div style={styles.photoHint}>
                  💡 Smart processing: Detects white background, removes if needed, resizes to ID card
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Personal Information</h4>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Full Name*</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                  style={{ ...styles.formInput, textTransform: 'uppercase' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={(e) => onFieldChange('username', e.target.value)}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={(e) => onFieldChange('password', e.target.value)}
                  placeholder="Leave blank to keep current"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={(e) => onFieldChange('gender', e.target.value)}
                  style={styles.formInput}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={(e) => onFieldChange('dob', e.target.value)}
                  style={styles.formInput}
                />
              </div>
            </div>
          </div>

          <div style={styles.formSection}>
            <h4 style={styles.sectionHeader}>Contact Information</h4>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Phone Number*</label>
                <input
                  type="text"
                  name="phone_no"
                  value={formData.phone_no}
                  onChange={(e) => onFieldChange('phone_no', e.target.value)}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Aadhar Number*</label>
                <input
                  type="text"
                  name="aadhar_no"
                  value={formData.aadhar_no}
                  onChange={(e) => onFieldChange('aadhar_no', e.target.value)}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Father's Name</label>
                <input
                  type="text"
                  name="father_name"
                  value={formData.father_name}
                  onChange={(e) => onFieldChange('father_name', e.target.value)}
                  style={{ ...styles.formInput, textTransform: 'uppercase' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={(e) => onFieldChange('address', e.target.value)}
                  style={{ ...styles.formInput, minHeight: '80px' }}
                />
              </div>
            </div>
          </div>

          {formData.user_type === 'student' && (
            <>
              <div style={styles.formSection}>
                <h4 style={styles.sectionHeader}>Enrollment Information</h4>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Class*</label>
                    <input
                      type="text"
                      name="class_name"
                      value={formData.class_name}
                      onChange={(e) => onClassChange(e.target.value)}
                      placeholder="Enter Class"
                      style={styles.formInput}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Section</label>
                    <input
                      type="text"
                      name="section"
                      value={formData.section}
                      onChange={(e) => onFieldChange('section', e.target.value)}
                      placeholder="Enter Section"
                      style={styles.formInput}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Class Teacher</label>
                    <input
                      type="text"
                      name="class_teacher"
                      value={formData.class_teacher}
                      onChange={(e) => onFieldChange('class_teacher', e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>School Name</label>
                    <input
                      type="text"
                      name="school_name"
                      value={formData.school_name}
                      onChange={(e) => onFieldChange('school_name', e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                </div>
              </div>

              <div style={styles.formSection}>
                <h4 style={styles.sectionHeader}>Academic IDs</h4>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Admission No.</label>
                    <input
                      type="text"
                      name="admission_no"
                      value={formData.admission_no}
                      onChange={(e) => onFieldChange('admission_no', e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Curriculum</label>
                    <input
                      type="text"
                      name="curriculum"
                      value={formData.curriculum || ''}
                      onChange={(e) => onFieldChange('curriculum', e.target.value)}
                      placeholder="e.g. CBSE / ICSE / State Board"
                      style={styles.formInput}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>CBSE Reg No.</label>
                    <input
                      type="text"
                      name="cbse_reg_no"
                      value={formData.cbse_reg_no}
                      onChange={(e) => onFieldChange('cbse_reg_no', e.target.value)}
                      style={styles.formInput}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {(formData.user_type === 'teacher' || formData.user_type === 'management') && (
            <div style={styles.formSection}>
              <h4 style={styles.sectionHeader}>Staff Details</h4>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation || ''}
                    onChange={(e) => onFieldChange('designation', e.target.value)}
                    style={styles.formInput}
                  />
                </div>
                {formData.user_type === 'teacher' && (
                  <>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                      <div style={styles.formGroup} key={num}>
                        <label style={styles.formLabel}>Teaches to Class {num}</label>
                        <input
                          type="text"
                          name={`teaches_to_${num}`}
                          value={formData[`teaches_to_${num}`] || ''}
                          onChange={(e) => onFieldChange(`teaches_to_${num}`, e.target.value)}
                          style={styles.formInput}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          <div style={styles.formActions}>
            <button type="submit" style={styles.saveButton} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onCancel} style={styles.cancelButton} disabled={isLoading}>
              Cancel
            </button>
          </div>
        </form>

        {/* 🔥 Full Screen Photo Preview Modal */}
        {showPhotoPreview && (
          <div
            style={styles.imagePreviewModal}
            onClick={() => setShowPhotoPreview(false)}
          >
      <img
  src={photoPreview}
  alt="Student"
  style={styles.largePreviewImage}
  onClick={() => setShowPhotoPreview(false)}
/>
          </div>
        )}

        {/* 🔥 Spin Animation CSS */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin-animation {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </Modal>

      {showCameraModal && (
        <Modal
          isOpen={showCameraModal}
          onRequestClose={closeCamera}
          contentLabel="Camera"
          style={styles.cameraModal}
        >
          <button
            type="button"
            onClick={closeCamera}
            style={styles.closeButton}
            title="Close camera"
          >
            <FaTimes />
          </button>

          <video
            ref={videoRef}
            style={styles.cameraVideo}
            autoPlay
            playsInline
            muted
          />

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={styles.cameraControls}>
            <button
              type="button"
              onClick={capturePhoto}
              style={styles.captureButton}
            >
              <FaCamera size={20} />
              Capture Photo
            </button>
          </div>

          {cameraError && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              fontSize: '14px',
            }}>
              {cameraError}
            </div>
          )}
        </Modal>
      )}
    </>
  );
};

export default StudentEditingPopup;