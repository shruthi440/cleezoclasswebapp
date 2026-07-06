import React, { useRef } from 'react';
import Modal from 'react-modal';

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

  const styles = {
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
    photoPreview: {
      width: '120px',
      height: '120px',
      borderRadius: '4px',
      objectFit: 'cover',
      border: '1px solid #ddd',
    },
    photoPlaceholderLarge: {
      width: '120px',
      height: '120px',
      backgroundColor: '#eee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      color: '#666',
      borderRadius: '4px',
    },
    uploadButton: {
      padding: '8px 15px',
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      marginRight: '10px',
    },
    removeButton: {
      padding: '8px 15px',
      backgroundColor: '#e74c3c',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    },
  };

  return (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={styles.photoPreview} />
              ) : (
                <div style={styles.photoPlaceholderLarge}>No Photo</div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={onPhotoChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={styles.uploadButton}
              >
                {photoFile ? 'Change Photo' : 'Upload Photo'}
              </button>
              {photoFile && (
                <button type="button" onClick={onRemovePhoto} style={styles.removeButton}>
                  Remove
                </button>
              )}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                JPEG, PNG or GIF (Max 5MB)
              </div>
            </div>
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
                  {/* <select
                    name="class_name"
                    value={formData.class_name}
                    onChange={(e) => onClassChange(e.target.value)}
                    style={styles.formInput}
                  >
                    <option value="">-- Select Class --</option>
                    {classOptions.map((classValue, index) => (
                      <option key={index} value={classValue}>
                        {classValue}
                      </option>
                    ))}
                  </select> */}
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
    </Modal>
  );
};

export default StudentEditingPopup;
