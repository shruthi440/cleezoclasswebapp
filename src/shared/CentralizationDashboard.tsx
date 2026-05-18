import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

type UploadAsset = File | string | null;
type TabName = 'Details' | 'Management' | 'Staff' | 'Student' | 'Uploads';
type StepTitle = 'Details' | 'Management' | 'Staff' | 'Students' | 'Uploaded Files';
type UserType = 'student' | 'teacher' | 'management';
type FileFieldKey =
    | 'authorized_logo'
    | 'school_photo'
    | 'correspondent'
    | 'front_office'
    | 'other_photo';
type FormFieldKey = Exclude<keyof FormDataState, FileFieldKey>;

interface FormDataState {
    school_name: string;
    curriculum: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    school_code: string;
    school_strength: string;
    staff_strength: string;
    tagline: string;
    registration_no: string;
    authorized_logo: UploadAsset;
    school_photo: UploadAsset;
    correspondent: UploadAsset;
    front_office: UploadAsset;
    other_photo: UploadAsset;
    latitude: string;
    longitude: string;
    radius: string;
    use_radius: string;
    institute_authorized_person: string;
email: string;
email_app_key: string;


}

interface SchoolApiResponse {
    institute_name?: string;
    curriculum?: string;
    institute_address?: string;
    city_name?: string;
    state?: string;
    pincode?: string;
    school_code?: string;
    number_of_students?: string;
    number_of_staff?: string;
    tagline?: string;
    registration_no?: string;
    logo?: string | null;
    authorized_logo?: string | null;
    school_photo?: string | null;
    correspondent?: string | null;
    front_office?: string | null;
    other_photo?: string | null;
    latitude?: string;
    longitude?: string;
    radius?: string;
    use_radius?: string;
    institute_authorized_person?: string;
    email?: string;
    email_app_key?: string;
}

interface UploadedRecord extends Record<string, unknown> {
    phone?: string;
    phone_no?: string;
    father_phone_no?: string;
}

interface UploadResponse {
    insertedRecords: UploadedRecord[];
    duplicates: UploadedRecord[];
    skippedRows?: number;
}

interface TrackingStats {
    teacher: number;
    student: number;
    management: number;
}

interface TrackingApiResponse {
    success: boolean;
    stats: TrackingStats;
}

interface AddUserFormState {
    user_type: UserType;
    name: string;
    username: string;
    password: string;
    gender: string;
    phone_no: string;
    father_phone_no: string;
    aadhar_no: string;
    father_name: string;
    class_name: string;
    section: string;
    class_teacher: string;
    school_name: string;
    address: string;
    dob: string;
    admission_no: string;
    cbse_reg_no: string;
    curriculum: string;
    designation: string;
    teaches_to_1: string;
    teaches_to_2: string;
    teaches_to_3: string;
    teaches_to_4: string;
    teaches_to_5: string;
    teaches_to_6: string;
    teaches_to_7: string;
    teaches_to_8: string;
    teaches_to_9: string;
    teaches_to_10: string;
    teaches_to_11: string;
    teaches_to_12: string;
}

interface CreatedCredentials {
    name: string;
    username: string;
    password: string;
    user_type: UserType;
}

const createAddUserForm = (
    userType: UserType,
    defaults?: Partial<AddUserFormState>
): AddUserFormState => ({
    user_type: userType,
    name: '',
    username: '',
    password: '',
    gender: '',
    phone_no: '',
    father_phone_no: '',
    aadhar_no: '',
    father_name: '',
    class_name: '',
    section: '',
    class_teacher: '',
    school_name: '',
    address: '',
    dob: '',
    admission_no: '',
    cbse_reg_no: '',
    curriculum: '',
    designation: '',
    teaches_to_1: '',
    teaches_to_2: '',
    teaches_to_3: '',
    teaches_to_4: '',
    teaches_to_5: '',
    teaches_to_6: '',
    teaches_to_7: '',
    teaches_to_8: '',
    teaches_to_9: '',
    teaches_to_10: '',
    teaches_to_11: '',
    teaches_to_12: '',
    ...defaults,
});

const managementDesignationOptions = [
    { label: 'Correspondent', value: 'superadmin' },
    { label: 'Principal', value: 'admin' },
    { label: 'Campaigning', value: 'marketing' },
    { label: 'Accountant', value: 'accountant' },
    { label: 'HR', value: 'hr' },
] as const;

const initialFormData: FormDataState = {
    school_name: '',
    curriculum: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    school_code: '',
    school_strength: '',
    staff_strength: '',
    tagline: '',
    registration_no: '',
    authorized_logo: null,
    school_photo: null,
    correspondent: null,
    front_office: null,
    other_photo: null,
    latitude: '',
    longitude: '',
    radius: '',
    use_radius: '',
    institute_authorized_person: '',
email: '',
email_app_key: '',

};

const photoFields: Array<{ key: FileFieldKey; label: string }> = [
    { key: 'school_photo', label: 'School Photo *' },
    { key: 'correspondent', label: 'Correspondent' },
    { key: 'front_office', label: 'Front Office' },
    { key: 'other_photo', label: 'Other' },
];

const cameraIcon = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="18" width="44" height="30" rx="6" fill="#d9d9d9" stroke="#888" stroke-width="3"/><path d="M22 18l4-6h12l4 6" fill="#d9d9d9" stroke="#888" stroke-width="3"/><circle cx="32" cy="33" r="9" fill="#fff" stroke="#888" stroke-width="3"/></svg>'
)}`;

const applicationIcon = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="12" y="12" width="40" height="40" rx="8" fill="#2b6cb0"/><path d="M24 32h16M32 24l8 8-8 8" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
)}`;

const clickHiddenInput = (id: string) => {
    document.getElementById(id)?.click();
};

const CentralizationDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabName>('Details');
    const [formData, setFormData] = useState<FormDataState>(initialFormData);
    const [uploading, setUploading] = useState(false);
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [uploadedData, setUploadedData] = useState<UploadedRecord[]>([]);
    const [previewData, setPreviewData] = useState<any[]>([]);
const [showPreview, setShowPreview] = useState(false);
    const [trackingStats, setTrackingStats] = useState<TrackingStats>({
        teacher: 0,
        student: 0,
        management: 0,
    });
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isAddUserSubmitting, setIsAddUserSubmitting] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
    const [addUserForm, setAddUserForm] = useState<AddUserFormState>(
        createAddUserForm('student')
    );

    useEffect(() => {
        const loadSchoolDetails = async () => {
            const username = localStorage.getItem('username');
            const schoolCode = localStorage.getItem('schoolCode');
            const instituteName = localStorage.getItem('instituteName');

            if (!username && !schoolCode && !instituteName) return;

            try {
                const urls: string[] = [];
                const query = new URLSearchParams();
                if (username) query.set('username', username);
                if (schoolCode) query.set('schoolCode', schoolCode);
                if (instituteName) query.set('instituteName', String(instituteName));

                urls.push(
                    `https://cleezoclass.com:4000/api/api/school-lookup?${query.toString()}`,
                    `https://cleezoclass.com:4000/api/school-lookup?${query.toString()}`
                );

                let data: SchoolApiResponse | null = null;
                for (const url of urls) {
                    try {
                        const res = await axios.get<SchoolApiResponse>(url);
                        data = res.data;
                        break;
                    } catch {
                        // Try next endpoint variant
                    }
                }

                if (!data) {
                    console.warn('School details not found for username/instituteName', {
                        username,
                        schoolCode,
                        instituteName,
                    });
                    return;
                }

                const resolvedSchoolCode = data.school_code || schoolCode || '';
                const resolvedInstituteName = data.institute_name || instituteName || '';

                if (resolvedSchoolCode) {
                    localStorage.setItem('schoolCode', resolvedSchoolCode);
                }

                if (resolvedInstituteName) {
                    localStorage.setItem('instituteName', resolvedInstituteName);
                }

                setFormData({
                    school_name: resolvedInstituteName,
                    curriculum: data.curriculum || '',
                    address: data.institute_address || '',
                    city: data.city_name || '',
                    state: data.state || '',
                    pincode: data.pincode || '',
                    school_code: resolvedSchoolCode,
                    school_strength: data.number_of_students || '',
                    staff_strength: data.number_of_staff || '',
                    tagline: data.tagline || '',
                    registration_no: data.registration_no || '',
                    authorized_logo: data.logo || data.authorized_logo || null,
                    school_photo: data.school_photo || null,
                    correspondent: data.correspondent || null,
                    front_office: data.front_office || null,
                    other_photo: data.other_photo || null,
                    latitude: data.latitude || '',
                    longitude: data.longitude || '',
                    radius: data.radius || '',
                    use_radius: data.use_radius || '',
                    institute_authorized_person: data.institute_authorized_person || '',
                    email: data.email || '',
                    email_app_key: data.email_app_key || '',
                });
            } catch (err) {
                console.error('Fetch error:', err);
            }
        };

        loadSchoolDetails();
    }, []);

    

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name as FormFieldKey]: value }));
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, key: FileFieldKey) => {
        const file = e.target.files?.[0] ?? null;
        setFormData((prev) => ({ ...prev, [key]: file }));
    };

    const openAddUserModal = (userType: UserType) => {
        setCreatedCredentials(null);
        setAddUserForm(
            createAddUserForm(userType, {
                school_name: formData.school_name || localStorage.getItem('instituteName') || '',
                address: formData.address || '',
                curriculum: formData.curriculum || '',
            })
        );
        setIsAddUserOpen(true);
    };

    const closeAddUserModal = () => {
        setIsAddUserOpen(false);
        setCreatedCredentials(null);
    };

    const handleAddUserChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        const field = name as keyof AddUserFormState;
        setAddUserForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleAddUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const schoolCode = formData.school_code || localStorage.getItem('schoolCode');
        if (!schoolCode) {
            alert('School Code missing');
            return;
        }

        const userType = addUserForm.user_type;
        const payload = {
            ...addUserForm,
            schoolCode,
            category: userType,
            school_name:
                addUserForm.school_name || formData.school_name || localStorage.getItem('instituteName') || '',
            address: addUserForm.address || formData.address || '',
            curriculum: addUserForm.curriculum || formData.curriculum || '',
            Curriculum: addUserForm.curriculum || formData.curriculum || '',
            phone_no:
                userType === 'student'
                    ? addUserForm.father_phone_no || addUserForm.phone_no
                    : addUserForm.phone_no,
        };

        try {
            setIsAddUserSubmitting(true);
            const response = await axios.post(
                'https://cleezoclass.com:4000/api/submit-studentData',
                payload,
                {
                    params: { schoolCode },
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const responseData = response.data?.data || {};
            setCreatedCredentials({
                name: String(responseData.name || addUserForm.name || ''),
                username: String(responseData.username || addUserForm.username || ''),
                password: String(responseData.password || addUserForm.password || ''),
                user_type: userType,
            });

            alert(response.data?.message || `${userType} added successfully`);
            setAddUserForm(createAddUserForm(userType));
        } catch (error: any) {
            console.error('Error adding user:', error?.response?.data || error?.message || error);
            alert(error?.response?.data?.message || 'Failed to add user');
        } finally {
            setIsAddUserSubmitting(false);
        }
    };

    const copyCredentials = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Clipboard access can fail in some browser contexts; the text is still visible.
        }
    };

    const handleUpdate = () => {
        const schoolCode = localStorage.getItem('schoolCode');
        const uploadData = new FormData();

        (Object.keys(formData) as Array<keyof FormDataState>).forEach((key) => {
            const value = formData[key];
            if (key === 'authorized_logo') {
                if (value instanceof File) {
                    uploadData.append('logo', value);
                }
                return;
            }

            uploadData.append(key, value instanceof File ? value : value ?? '');
        });

        axios
            .put(`https://cleezoclass.com:4000/api/api/schooleditingdatacentralization/${schoolCode}`, uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then(() => alert('Updated successfully'))
            .catch(() => alert('Update failed'));
    };


    const handleFileUpload = async (category: string) => {
        if (!excelFile) {
            alert('Please choose an Excel file first');
            return;
        }

        const schoolCode = formData.school_code || localStorage.getItem('schoolCode');

        if (!schoolCode) {
            alert('School Code missing');
            return;
        }

        const uploadData = new FormData();
        uploadData.append('file', excelFile);
        uploadData.append('school_code', schoolCode);

        try {
            setUploading(true);

            const apiCategory = category.toLowerCase() === 'staff' ? 'teacher' : category.toLowerCase();

            const response = await axios.post<UploadResponse>(
                `https://cleezoclass.com:4000/api/upload-excel/${apiCategory}`,
                uploadData,
                {
                    params: { schoolCode },
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );

            const { insertedRecords, duplicates, skippedRows = 0 } = response.data;
            setUploadedData(insertedRecords);

            alert(
                `Upload Successful!\nInserted: ${insertedRecords.length}\nDuplicates: ${duplicates.length}\nSkipped: ${skippedRows}`
            );

            setExcelFile(null);
        } catch (error) {
            console.error('Excel upload failed:', error);
            alert('Excel upload failed');
        } finally {
            setUploading(false);
        }
    };
    const getValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    const foundKey = Object.keys(row).find(
      (col) => col.toLowerCase().replace(/\s+/g, "_") === key.toLowerCase()
    );

    if (foundKey && row[foundKey] !== undefined) {
      return row[foundKey];
    }
  }
  return "";
};
    const handlePreview = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData = XLSX.utils.sheet_to_json(worksheet);
const formattedData = rawData.map((row: any) => ({
  student_name: getValue(row, [
    "student_name",
    "student name",
    "name",
    "student",
  ]).toString().toUpperCase() || "",

  gender: getValue(row, ["gender", "sex"]),

  phone_number: getValue(row, [
    "phone_number",
    "phone number",
    "phone",
    "mobile",
    "father_phone",
    "father_mobile",
  ]),

  aadhar_number: getValue(row, [
    "aadhar_number",
    "aadhar number",
    "aadhar",
    "aadhaar",
  ]),

  father_name: getValue(row, [
    "father_name",
    "father name",
    "dad_name",
    "dad",
    "father",
  ]).toString().toUpperCase() || "",

  class: getValue(row, ["class", "class_name", "grade"]),

  section: getValue(row, ["section", "sec"]),

  class_teacher: getValue(row, [
    "class_teacher",
    "teacher",
    "teacher_name",
  ]).toString().toUpperCase() || "",

  address: getValue(row, ["address", "student_address"]),
}));

        setPreviewData(formattedData);
        setShowPreview(true);
    };

    reader.readAsBinaryString(file);
};
const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

useEffect(() => {
  const handleResize = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);
    const downloadExcel = () => {
        if (uploadedData.length === 0) {
            alert('No data to download');
            return;
        }

        const dataWithWhatsapp = uploadedData.map((item) => {
            const itemPhone = typeof item.phone === 'string' ? item.phone : '';
            const phoneNo = typeof item.phone_no === 'string' ? item.phone_no : '';
            const fatherPhoneNo =
                typeof item.father_phone_no === 'string' ? item.father_phone_no : '';
            const phone = itemPhone.trim() !== '' ? itemPhone : phoneNo || fatherPhoneNo || '';
            const whatsappLink = phone ? `https://wa.me/${phone}` : 'N/A';

            return { ...item, phone, whatsappLink };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataWithWhatsapp);
        XLSX.utils.book_append_sheet(wb, ws, 'UploadedData');
        XLSX.writeFile(wb, 'uploaded_data.xlsx');
    };

    const stepColors = ['#3182ce', '#c05621', '#ecc94b', '#3182ce', '#48bb78'];

    useEffect(() => {
        const schoolCode = formData.school_code || localStorage.getItem('schoolCode');

        console.log('🔍 [Tracker Sync] Checking for schoolCode in localStorage...');
        if (!schoolCode) {
            console.warn('⚠️ [Tracker Sync] No schoolCode found. Skipping API call.');
            return;
        }

        console.log(`📡 [Tracker Sync] Fetching stats for: ${schoolCode}`);
        axios
            .get<TrackingApiResponse>(`https://cleezoclass.com:4000/track-records/${schoolCode}`)
            .then((res) => {
                if (res.data.success) {
                    console.log('✅ [Tracker Sync] Data received successfully:', res.data.stats);
                    setTrackingStats(res.data.stats);
                } else {
                    console.error('❌ [Tracker Sync] API responded but success was false:', res.data);
                }
            })
            .catch((err: Error) => {
                console.error('🔥 [Tracker Sync] Critical error during fetch:', err.message);
            });
    }, [uploadedData, formData.school_code]);

    const isStepComplete = (stepTitle: StepTitle) => {
        switch (stepTitle) {
            case 'Details':
                return !!(formData.school_name && formData.address);
            case 'Management':
                return trackingStats.management > 0 || !!formData.school_code;
            case 'Staff':
                return trackingStats.teacher > 0;
            case 'Students':
                return trackingStats.student > 0;
            case 'Uploaded Files':
                return !!(formData.latitude && formData.longitude);
            default:
                return false;
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('instituteName');
        localStorage.removeItem('username');
        localStorage.removeItem('schoolCode');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userType');
        localStorage.removeItem('name');
        sessionStorage.clear();
        navigate('/', { replace: true });
    };

    return (
        <div style={styles.container}>
            {/* HEADER */}
       {/* HEADER */}
<div style={styles.header}>
  
  {/* LEFT: Logo + Name */}
  <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1 }}>
    
    <div 
      style={styles.logoBox} 
      onClick={() => clickHiddenInput('file-authorized_logo')}
    >
      {formData.authorized_logo ? (
        <img 
          src={
            formData.authorized_logo instanceof File 
              ? URL.createObjectURL(formData.authorized_logo) 
              : formData.authorized_logo
          } 
          alt="School Logo" 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
        />
      ) : (
        <>School Logo</>
      )}

      <input
        id="file-authorized_logo"
        type="file"
        accept="image/*"
        onChange={(e) => handlePhotoChange(e, 'authorized_logo')}
        style={{ display: 'none' }}
      />
    </div>

    <div style={styles.schoolNameBox}>
      {formData.school_name || 'School Name'}
    </div>

  </div>

  {/* RIGHT: Logout */}
  <button style={styles.logoutBtn} onClick={handleLogout}>
    Logout
  </button>

</div>
            {/* NAV BAR */}
            <div style={styles.navBar}>
                {(['Details', 'Management', 'Staff', 'Student', 'Uploads'] as TabName[]).map((tab) => (
                    <div
                        key={tab}
                        style={{ ...styles.navTab, ...(activeTab === tab ? styles.activeTab : {}) }}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </div>
                ))}
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={activeTab === 'Uploads' ? styles.uploadsMainContent : styles.mainContent}>
                
                {/* --- DETAILS TAB VIEW --- */}
                {activeTab === 'Details' && (
                    <>
                        {/* LEFT COLUMN */}
           <div>
  {/* School Name + Curriculum */}
  <div style={styles.row}>
    <div style={{ ...styles.inputGroup, flex: 1, marginRight: '15px' }}>
      <label style={styles.label}>School Name</label>
      <input
        name="school_name"
        value={formData.school_name}
        onChange={handleChange}
        placeholder="Enter School Name"
        style={styles.input}
      />
    </div>

    <div style={{ ...styles.inputGroup, flex: 1 }}>
      <label style={styles.label}>Curriculum</label>
      <select
        name="curriculum"
        value={formData.curriculum}
        onChange={handleChange}
        style={styles.input}
      >
        <option value="" disabled>Select Curriculum</option>
        <option value="CBSE">CBSE</option>
        <option value="ICSE">ICSE</option>
      </select>
    </div>
  </div>

  {/* Address */}
  <div style={{ ...styles.inputGroup, marginBottom: '15px' }}>
    <label style={styles.label}>Address</label>
    <input
      name="address"
      value={formData.address}
      onChange={handleChange}
      placeholder="Enter Address"
      style={styles.input}
    />
  </div>
  {/* AUTHORIZED PERSON 1 */}
<div style={styles.row}>
  <div style={styles.inputGroup}>
    <label style={styles.label}>Authorized Person</label>
    <input
      name="institute_authorized_person"
      value={formData.institute_authorized_person}
      onChange={handleChange}
      placeholder="Enter Name"
      style={styles.input}
    />
  </div>

  <div style={styles.inputGroup}>
    <label style={styles.label}>Email</label>
    <input
      name="email"
      value={formData.email}
      onChange={handleChange}
      placeholder="Enter Email"
      style={styles.input}
    />
  </div>

  <div style={styles.inputGroup}>
    <label style={styles.label}>Email App Key</label>
    <input
      name="email_app_key"
      value={formData.email_app_key}
      onChange={handleChange}
      placeholder="Enter App Key"
      style={styles.input}
    />
  </div>
</div>

  {/* City + State */}
  <div style={styles.row}>
    <div style={{ ...styles.inputGroup, flex: 1, marginRight: '15px' }}>
      <label style={styles.label}>City</label>
      <input
        name="city"
        value={formData.city}
        onChange={handleChange}
        placeholder="Enter City"
        style={styles.input}
      />
    </div>

    <div style={{ ...styles.inputGroup, flex: 1 }}>
      <label style={styles.label}>State</label>
      <select
        name="state"
        value={formData.state}
        onChange={handleChange}
        style={styles.input}
      >
        <option value="" disabled>Select State</option>
        <option value="Telangana">Telangana</option>
        <option value="Andhra Pradesh">Andhra Pradesh</option>
      </select>
    </div>
  </div>
<div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
  {/* Pincode */}
  <div style={{ ...styles.inputGroup, flex: 1 }}>
    <label style={styles.label}>Pincode</label>
    <input
      name="pincode"
      value={formData.pincode}
      onChange={handleChange}
      placeholder="Enter Pincode"
      style={styles.input}
    />
  </div>

  {/* Next Button */}
  <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
    <button style={{ ...styles.nextBtn, width: 'auto', padding: '10px 20px' }}>
      Next &gt;
    </button>
  </div>
</div>

</div>
                        {/* MIDDLE COLUMN */}
                      <div style={{ borderLeft: '4px solid #ccc', paddingLeft: '30px' }}>
<div style={{ ...styles.row }}>
  <div style={{ ...styles.inputGroup, flex: 1 }}>
        <label style={styles.label}>School code.</label>

    <input
      name="school_code"
      value={formData.school_name}
      placeholder="School Code"
      style={{ ...styles.input, width: '100%' }}
    />
  </div>

  <div style={{ ...styles.inputGroup, flex: 1, marginLeft: '15px' }}>
    <label style={styles.label}>School Reg. No.</label>
<input
  name="registration_no"               
  value={formData.registration_no}
  onChange={handleChange}             
  placeholder="Enter Registration Number"
  style={{ ...styles.input, width: '100%' }}
/>

  </div>
</div>

  <div style={styles.row}>
    <input
      name="school_strength"
      value={formData.school_strength}
      onChange={handleChange}
      placeholder="No. of Students"
      style={styles.input}
    />

    <input
      name="staff_strength"
      value={formData.staff_strength}
      onChange={handleChange}
      placeholder="No. of Staff"
      style={styles.input}
    />
  </div>

  <div style={styles.row}>
    <div style={styles.inputGroup}>
      <label style={styles.label}>Departments *</label>
      <select style={styles.input}>
        <option value="" disabled>Select Department</option>
        <option>Store / Library</option>
      </select>
    </div>
    <div style={styles.inputGroup}>
      <label style={styles.label}>Activities *</label>
      <select style={styles.input}>
        <option value="" disabled>Select Activity</option>
        <option>Skating / Karate</option>
      </select>
    </div>
  </div>

<div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
  <input
    name="tagline"
    value={formData.tagline}
    onChange={handleChange}
    placeholder="Enter branches"
    style={{ ...styles.input, flex: 1 }} // flex:1 makes input take remaining width
  />

    <button style={{ ...styles.nextBtn, width: 'auto', padding: '10px 20px' }}>
      Next &gt;
    </button>
</div>

</div>

                        {/* RIGHT COLUMN (PHOTOS) */}
                     <div
                       style={{
                         display: 'flex',
                         alignItems: 'flex-start',
                         gap: '40px',
                         borderLeft: '4px solid #ccc',
                         paddingLeft: '30px',
                       }}
                     >
                       {/* Left: Photo Uploads in 2x2 grid */}
                       <div
                         style={{
                           display: 'grid',
                           gridTemplateColumns: 'repeat(2, 180px)', // 2 images per row
                           gap: '20px 20px', // row-gap and column-gap
                         }}
                       >
                         {photoFields.map((photo) => {
                           const photoValue = formData[photo.key];

                           return (
                           <div key={photo.key} style={{ textAlign: 'left' }}>
                             <label style={styles.label1}>{photo.label}</label>
                     
                             <div
                               style={styles.photoBox}
                               onClick={() => clickHiddenInput(`file-${photo.key}`)}
                             >
                               {photoValue ? (
                                 <img
                                   src={
                                     photoValue instanceof File
                                       ? URL.createObjectURL(photoValue)
                                       : photoValue
                                   }
                                   alt={photo.label}
                                   style={styles.previewImage}
                                 />
                               ) : (
                                 <img src={cameraIcon} alt="camera" style={styles.iconStyle} />
                               )}
                             </div>
                     
                             <input
                               id={`file-${photo.key}`}
                               type="file"
                               accept="image/*"
                               onChange={(e) => handlePhotoChange(e, photo.key)}
                               style={{ display: 'none' }}
                             />
                           </div>
                           );
                         })}
                       </div>
                     
                     {/* Right: Update/Application Icon */}
                     <div style={{ display: 'flex', alignItems: 'center' }}>
                       <div
                         style={{
                           ...styles.photoBox,
                           width: '100px',   // set the width of the container
                           height: '100px',  // optional: make it square
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           marginTop:'80px'
                         }}
                       >
                         <img
                           src={applicationIcon}
                           alt="Update"
                           onClick={handleUpdate}
                           style={{
                             ...styles.updateIconStyle,
                             width: '80%',  // img fills the container width
                             height: '80%', // img fills container height
                             objectFit: 'contain', // maintain aspect ratio
                             filter: 'invert(35%) sepia(100%) saturate(5000%) hue-rotate(180deg) brightness(95%) contrast(90%)',
                             transition: 'transform 0.2s',
                             cursor: 'pointer',
                           }}
                           onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                           onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                         />
                       </div>
                     </div>
                     
                     </div>
                    </>
                )}

                {/* --- UPLOADS TAB VIEW (AS PER IMAGE) --- */}
                {activeTab === 'Uploads' && (
                    <>
                        {/* 1. Time Table */}
                        <div style={styles.uploadSection}>
                            <h3 style={styles.sectionHeading}>Time Table</h3>
                            <div style={styles.inputGrid}>
                                <div style={styles.inputGroup}><label style={styles.label}>Class</label><select style={styles.input}><option>Select</option></select></div>
                                <div style={styles.inputGroup}><label style={styles.label}>Section</label><select style={styles.input}><option>Select</option></select></div>
                                <div style={styles.inputGroup}><label style={styles.label}>Teacher</label><select style={styles.input}><option>Select</option></select></div>
                                <div style={styles.inputGroup}><label style={styles.label}>Day</label><select style={styles.input}><option>Select</option></select></div>
                            </div>
                            <div style={styles.uploadButtonGroup}>
                                <button style={styles.actionBtn}>Upload Time Table</button>
                                <span style={styles.orLabel}>(or)</span>
                                <button style={styles.actionBtn}>Generate New</button>
                            </div>
                        </div>

                        {/* 2. School Calendar */}
                        <div style={{ ...styles.uploadSection, borderLeft: '2px solid #ddd', borderRight: '2px solid #ddd' }}>
                            <h3 style={styles.sectionHeading}>School Calendar</h3>
                            <div style={styles.inputGrid}>
                                <div style={styles.inputGroup}><label style={styles.label}>First Day *</label><input type="date" style={styles.input} /></div>
                                <div style={styles.inputGroup}><label style={styles.label}>Last Day *</label><input type="date" style={styles.input} /></div>
                                <div style={styles.inputGroup}><label style={styles.label}>Annual Day</label><input type="date" style={styles.input} /></div>
                                <div style={styles.inputGroup}><label style={styles.label}>Freshers Day</label><input type="date" style={styles.input} /></div>
                            </div>
                            <div style={styles.uploadButtonGroup}>
                                <button style={styles.actionBtn}>Upload Calendar</button>
                                <span style={styles.orLabel}>(or)</span>
                                <button style={styles.actionBtn}>Generate New</button>
                            </div>
                        </div>

                        {/* 3. School Radius Setup */}
                    <div style={styles.uploadSection}>
  <h3 style={styles.sectionHeading}>School Radius Setup</h3>
  <div style={styles.inputGrid}>
    {/* Branch / School Name */}
    <div style={styles.inputGroup}>
      <label style={styles.label}>Branch *</label>
      <input
        name="school_name"
        value={formData.school_name}
        onChange={handleChange}
        placeholder="Enter School Name"
        style={styles.input}
      />
    </div>

    {/* Address */}
    <div style={styles.inputGroup}>
      <label style={styles.label}>Address</label>
      <input
        name="address"
        value={formData.address}
        onChange={handleChange}
        placeholder="Enter Address"
        style={styles.input}
      />
    </div>

    {/* Latitude */}
    <div style={styles.inputGroup}>
      <label style={styles.label}>Latitude *</label>
      <input
        name="latitude"
        placeholder="Lat"
        value={formData.latitude}
        onChange={handleChange}
        style={styles.input}
      />
    </div>

    {/* Longitude */}
    <div style={styles.inputGroup}>
      <label style={styles.label}>Longitude *</label>
      <input
        name="longitude"
        placeholder="Long"
        value={formData.longitude}
        onChange={handleChange}
        style={styles.input}
      />
    </div>

    {/* Radius */}
{/* Radius */}
<div style={styles.inputGroup}>
  <label style={styles.label}>Radius (meters)</label>
  <input
    name="radius"
    placeholder="Enter Radius"
    value={formData.radius}
    onChange={handleChange}
    style={styles.input}
  />
</div>

{/* Use Radius as text input */}
<div style={styles.inputGroup}>
  <label style={styles.label}>Use Radius</label>
  <input
    type="text"
    name="use_radius"
    placeholder="Enter Use Radius"
    value={formData.use_radius}
    onChange={handleChange}
    style={styles.input}
  />
</div>

  </div>

  <button
    style={{ ...styles.actionBtn, width: '100%', marginTop: '30px' }}
    onClick={handleUpdate}
  >
    Submit
  </button>
</div>

                    </>
                )}
            </div>
{(['Management', 'Staff', 'Student'] as TabName[]).includes(activeTab) && (
  <div style={styles.managementContainer}>
    <div style={styles.tabActionHeader}>
      <h3 style={styles.sectionHeading}>
        {activeTab === "Staff" ? "Teacher" : activeTab} Bulk Upload
      </h3>
      <button
        type="button"
        style={styles.addUserBtn}
        onClick={() =>
          openAddUserModal(
            activeTab === 'Staff'
              ? 'teacher'
              : activeTab === 'Management'
              ? 'management'
              : 'student'
          )
        }
      >
        Add {activeTab === 'Staff' ? 'Teacher' : activeTab}
      </button>
    </div>

    <div style={{ maxWidth: "520px" }}>

      {/* ROW 1: File name + File type */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <input
          type="text"
          placeholder="File Name"
          value={excelFile ? excelFile.name : ""}
          readOnly
          style={{ ...styles.input, flex: 1 }}
        />

        <input
          type="text"
          placeholder="File Type"
          value={
            excelFile
              ? excelFile.name.split(".").pop()?.toUpperCase() ?? ""
              : ""
          }
          readOnly
          style={{ ...styles.input, flex: 1 }}
        />
      </div>

      {/* ROW 2: Choose + Submit */}
      <div style={{ display: "flex", gap: "12px" }}>
        <label
          style={{
            ...styles.uploadBtn,
            flex: 1,
            textAlign: "center",
          }}
        >
          Choose Excel File
          <input
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => {
    const file = e.target.files?.[0] ?? null;
    setExcelFile(file);

    if (file) {
        handlePreview(file);
    }
}}
          />
        </label>

        <button
          style={{
            ...styles.submitBtn,
            flex: 1,
            backgroundColor: excelFile ? "#404040" : "#999",
          }}
          disabled={!excelFile || uploading}
          onClick={() => handleFileUpload(activeTab)}
        >
          {uploading ? "Uploading..." : "Submit Excel"}
        </button>
          {uploadedData.length > 0 && (
  <button
    style={{
      marginTop: "12px",
      padding: "8px 16px",
      backgroundColor: "#2f855a",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    }}
    onClick={downloadExcel}
  >
    Download Uploaded Data
  </button>
)}


      </div>

    </div>
  </div>
)}
{isAddUserOpen && (
  <div style={styles.modalOverlay}>
    <div style={styles.modalCard}>
      <div style={styles.modalHeader}>
        <div>
          <h3 style={styles.modalTitle}>Add {addUserForm.user_type}</h3>
          <p style={styles.modalSubtitle}>Create a new {addUserForm.user_type} account for this school.</p>
        </div>
        <button type="button" onClick={closeAddUserModal} style={styles.modalCloseBtn}>
          ×
        </button>
      </div>

      {createdCredentials && (
        <div style={styles.credentialsCard}>
          <div style={styles.credentialsHeader}>
            <div style={styles.credentialsHeaderLeft}>
              <div style={styles.credentialsIconWrap}>✓</div>
              <div>
                <div style={styles.credentialsTitle}>User created successfully</div>
                <div style={styles.credentialsSubtitle}>
                  Copy these login details before closing the panel.
                </div>
              </div>
            </div>
            <span style={styles.credentialsBadge}>{createdCredentials.user_type}</span>
          </div>
          <div style={styles.credentialsGrid}>
            <div style={styles.credentialsBlock}>
              <div style={styles.credentialsLabel}>Name</div>
              <div style={styles.credentialsValue}>{createdCredentials.name || '-'}</div>
            </div>
            <div style={styles.credentialsBlock}>
              <div style={styles.credentialsLabel}>Username</div>
              <div style={styles.credentialsValueRow}>
                <span style={styles.credentialsMono}>{createdCredentials.username || '-'}</span>
                <button
                  type="button"
                  style={styles.copyMiniBtn}
                  onClick={() => copyCredentials(createdCredentials.username || '')}
                  disabled={!createdCredentials.username}
                >
                  Copy
                </button>
              </div>
            </div>
            <div style={styles.credentialsBlock}>
              <div style={styles.credentialsLabel}>Password</div>
              <div style={styles.credentialsValueRow}>
                <span style={styles.credentialsMono}>{createdCredentials.password || '-'}</span>
                <button
                  type="button"
                  style={styles.copyMiniBtn}
                  onClick={() => copyCredentials(createdCredentials.password || '')}
                  disabled={!createdCredentials.password}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleAddUserSubmit} style={styles.modalForm}>
        <div style={styles.modalGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Full Name *</label>
            <input
              name="name"
              value={addUserForm.name}
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="Enter full name"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              name="username"
              value={addUserForm.username}
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="Optional"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              name="password"
              value={addUserForm.password}
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="Optional"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Gender</label>
            <select
              name="gender"
              value={addUserForm.gender}
              onChange={handleAddUserChange}
              style={styles.input}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>
              {addUserForm.user_type === 'student' ? "Father's Phone Number" : 'Phone Number'}
            </label>
            <input
              name={addUserForm.user_type === 'student' ? 'father_phone_no' : 'phone_no'}
              value={
                addUserForm.user_type === 'student'
                  ? addUserForm.father_phone_no
                  : addUserForm.phone_no
              }
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="Enter phone number"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Aadhar Number</label>
            <input
              name="aadhar_no"
              value={addUserForm.aadhar_no}
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="Enter Aadhar number"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Father Name</label>
            <input
              name="father_name"
              value={addUserForm.father_name}
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="Enter father name"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={addUserForm.dob}
              onChange={handleAddUserChange}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>School Name</label>
            <input
              name="school_name"
              value={addUserForm.school_name}
              onChange={handleAddUserChange}
              style={styles.input}
              placeholder="School name"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Address</label>
            <textarea
              name="address"
              value={addUserForm.address}
              onChange={handleAddUserChange}
              style={{ ...styles.input, minHeight: '84px', resize: 'vertical' }}
              placeholder="Enter address"
            />
          </div>
        </div>

        {addUserForm.user_type === 'student' && (
          <div style={styles.modalSection}>
            <h4 style={styles.modalSectionTitle}>Student Details</h4>
            <div style={styles.modalGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Class</label>
                <input
                  name="class_name"
                  value={addUserForm.class_name}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="Enter class"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Section</label>
                <input
                  name="section"
                  value={addUserForm.section}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="Enter section"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Class Teacher</label>
                <input
                  name="class_teacher"
                  value={addUserForm.class_teacher}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="Enter class teacher"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Admission No.</label>
                <input
                  name="admission_no"
                  value={addUserForm.admission_no}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="Enter admission number"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Curriculum</label>
                <input
                  name="curriculum"
                  value={addUserForm.curriculum}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="CBSE / ICSE / State"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>CBSE Reg No.</label>
                <input
                  name="cbse_reg_no"
                  value={addUserForm.cbse_reg_no}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="Enter CBSE reg no."
                />
              </div>
            </div>
          </div>
        )}

        {addUserForm.user_type === 'teacher' && (
          <div style={styles.modalSection}>
            <h4 style={styles.modalSectionTitle}>Designation</h4>
            <div style={styles.modalGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Designation</label>
                <input
                  name="designation"
                  value={addUserForm.designation}
                  onChange={handleAddUserChange}
                  style={styles.input}
                  placeholder="Enter designation"
                />
              </div>
            </div>
          </div>
        )}

        {addUserForm.user_type === 'management' && (
          <div style={styles.modalSection}>
            <h4 style={styles.modalSectionTitle}>Designation</h4>
            <div style={styles.modalGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Designation</label>
                <select
                  name="designation"
                  value={addUserForm.designation}
                  onChange={handleAddUserChange}
                  style={styles.input}
                >
                  <option value="">Select designation</option>
                  {managementDesignationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {addUserForm.user_type === 'teacher' && (
          <div style={styles.modalSection}>
            <h4 style={styles.modalSectionTitle}>Teaching Classes</h4>
            <div style={styles.modalGrid}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((num) => {
                const fieldName = `teaches_to_${num}` as keyof AddUserFormState;
                return (
                  <div style={styles.inputGroup} key={fieldName}>
                    <label style={styles.label}>Teaches to Class {num}</label>
                    <input
                      name={fieldName}
                      value={String(addUserForm[fieldName] || '')}
                      onChange={handleAddUserChange}
                      style={styles.input}
                      placeholder={`Class ${num}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={styles.modalActions}>
          <button type="button" onClick={closeAddUserModal} style={styles.cancelActionBtn}>
            Cancel
          </button>
          <button type="submit" style={styles.primaryActionBtn} disabled={isAddUserSubmitting}>
            {isAddUserSubmitting ? 'Saving...' : `Add ${addUserForm.user_type}`}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{/* STUDENT PREVIEW TABLE */}
{activeTab === "Student" &&
  showPreview &&
  previewData.length > 0 && (
    <div style={{ marginTop: "30px", overflowX: "auto" }}>
      <h3>📊 Student Preview</h3>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "10px",
          border: "1px solid #ddd",
        }}
      >
        <thead>
          <tr>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Student Name</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Gender</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Phone Number</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Aadhar Number</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Father Name</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Class</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Section</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Class Teacher</th>
            <th style={{ border: "1px solid #ddd", padding: "8px" }}>Address</th>
          </tr>
        </thead>

        <tbody>
          {previewData.map((row, index) => (
            <tr key={index}>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.student_name}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.gender}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.phone_number}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.aadhar_number}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.father_name}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.class}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.section}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.class_teacher}</td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{row.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
)}



          <div style={styles.progressFooter}>
<div style={styles.trackerRow}>
  {([
    { title: 'Details', sub: 'Details Submitted' },
    { title: 'Management', sub: 'Logins Created' },
    { title: 'Staff', sub: 'Staff Created' },
    { title: 'Students', sub: 'Students Created' },
    { title: 'Uploaded Files', sub: 'Files Uploaded' },
  ] as Array<{ title: StepTitle; sub: string }>).map((step, i, arr) => {
    const isDone = isStepComplete(step.title);
    const color = isDone ? stepColors[i] : '#cfcfcf'; 

    
    return (
      <React.Fragment key={i}>
        <div style={{ textAlign: 'center', minWidth: '110px' }}>
          <div
            style={{
              ...styles.stepCircle,
              borderColor: color,
              color: color,
              // Keep background light color if done, else white
              backgroundColor: isDone ? `${color}15` : '#fff', 
              // Switch from dashed to solid border when done
              borderStyle: isDone ? 'solid' : 'dashed',
              fontWeight: 'bold'
            }}
          >
            {/* CHANGED THIS LINE: Always show the index + 1 */}
            {i + 1}
          </div>
          <div style={{ ...styles.stepLabel, color: isDone ? '#333' : '#999' }}>
            <strong>{step.title}</strong>
          </div>
          <div style={styles.subLabel}>{step.sub}</div>
        </div>

        {/* CONNECTOR */}
        {i !== arr.length - 1 && (
          <div style={styles.connectorWrapper}>
            <div
              style={{
                ...styles.connectorLine,
                backgroundColor: isDone ? color : '#cfcfcf',
              }}
            />
            <div
              style={{
                ...styles.connectorArrow,
                borderLeftColor: isDone ? color : '#cfcfcf',
              }}
            />
          </div>
        )}
      </React.Fragment>
    );
  })}
</div>
       
             </div>
        </div>
    );
};

// 2. UPDATED STYLES
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f5f5f5",
    minHeight: "100vh",
    padding: "10px",
  },

header: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 20px",
  backgroundColor: "#fff",
},

  logoBox: {
    border: "1px dashed #999",
    width: "100px",
    height: "60px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "10px",
    cursor: "pointer",
    overflow: "hidden",
    backgroundColor: "#fff",
  },

schoolNameBox: {
  fontWeight: "bold",
  textAlign: "center",
  flex: 1, // ✅ takes middle space only
},
  logoutBtn: {
    backgroundColor: "#a0a0a0",
    color: "white",
    border: "none",
    padding: "8px 20px",
    borderRadius: "20px",
    cursor: "pointer",
  },

  navBar: {
    display: "flex",
    overflowX: "auto",
    backgroundColor: "#f3a673",
    padding: "0 10px",
  },

  navTab: {
    padding: "12px 20px",
    color: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  activeTab: {
    borderBottom: "3px solid #333",
    color: "#000",
  },

  mainContent: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    padding: "20px",
    margin: "10px",
    backgroundColor: "#f5f5f5",
    borderRadius: "8px",
  },

  uploadsMainContent: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    padding: "20px",
    margin: "10px",
  },

  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "10px",
  },

  inputGroup: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 250px",
    marginBottom: "10px",
  },

  label: {
    fontSize: "12px",
    color: "#555",
    marginBottom: "5px",
  },

  input: {
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    width: "100%",
  },

  nextBtn: {
    backgroundColor: "#333",
    color: "white",
    padding: "10px 15px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },

  photoBox: {
    border: "2px solid #ff4d6d",
    borderRadius: "12px",
    height: "80px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    cursor: "pointer",
    overflow: "hidden",
  },

  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  iconStyle: {
    width: "30px",
    opacity: 0.4,
  },

  updateIconStyle: {
    width: "50px",
    cursor: "pointer",
  },

  uploadSection: {
    padding: "10px",
  },

  sectionHeading: {
    fontSize: "16px",
    color: "#666",
    textAlign: "center",
    marginBottom: "15px",
  },

  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
  },

  actionBtn: {
    backgroundColor: "#444",
    color: "white",
    border: "none",
    padding: "10px",
    borderRadius: "6px",
    cursor: "pointer",
    width: "100%",
  },

  uploadBtn: {
    backgroundColor: "#404040",
    color: "white",
    padding: "10px",
    borderRadius: "5px",
    cursor: "pointer",
    textAlign: "center",
  },

  submitBtn: {
    backgroundColor: "#333",
    color: "white",
    padding: "10px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },

  managementContainer: {
    padding: "10px",
    margin: "10px",
    borderRadius: "8px",
    backgroundColor: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  tabActionHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "10px",
  },

  addUserBtn: {
    backgroundColor: "#1f6feb",
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 9999,
  },

  modalCard: {
    width: "min(980px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    backgroundColor: "#fff",
    borderRadius: "18px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
    padding: "20px",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "18px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    textTransform: "capitalize",
  },

  modalSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },

  modalCloseBtn: {
    border: "none",
    background: "transparent",
    fontSize: "28px",
    lineHeight: 1,
    cursor: "pointer",
    color: "#334155",
  },

  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  credentialsCard: {
    marginBottom: "18px",
    border: "1px solid rgba(134, 239, 172, 0.65)",
    background:
      "linear-gradient(135deg, rgba(240, 253, 244, 0.98) 0%, rgba(220, 252, 231, 0.92) 100%)",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 12px 30px rgba(22, 101, 52, 0.12)",
  },

  credentialsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
    color: "#166534",
  },

  credentialsHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },

  credentialsIconWrap: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#166534",
    color: "#fff",
    fontWeight: 800,
    boxShadow: "0 8px 18px rgba(22, 101, 52, 0.22)",
    flexShrink: 0,
  },

  credentialsTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#14532d",
    lineHeight: 1.2,
  },

  credentialsSubtitle: {
    marginTop: "2px",
    fontSize: "12px",
    color: "#4b5563",
  },

  credentialsBadge: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },

  credentialsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },

  credentialsBlock: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    border: "1px solid rgba(134, 239, 172, 0.45)",
    borderRadius: "14px",
    padding: "12px 14px",
    backdropFilter: "blur(4px)",
  },

  credentialsLabel: {
    fontSize: "12px",
    color: "#4b5563",
    marginBottom: "4px",
  },

  credentialsValue: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-word",
  },

  credentialsValueRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-word",
  },

  credentialsMono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: "13px",
    color: "#0f172a",
    wordBreak: "break-all",
  },

  copyMiniBtn: {
    border: "none",
    backgroundColor: "#14532d",
    color: "#fff",
    borderRadius: "999px",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: "0 6px 14px rgba(20, 83, 45, 0.18)",
  },

  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },

  modalSection: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "14px",
    backgroundColor: "#f8fafc",
  },

  modalSectionTitle: {
    margin: "0 0 12px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#1e293b",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },

  cancelActionBtn: {
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#334155",
    borderRadius: "10px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },

  primaryActionBtn: {
    border: "none",
    backgroundColor: "#0f766e",
    color: "#fff",
    borderRadius: "10px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },

  progressFooter: {
    padding: "10px",
  },

  trackerRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "10px",
  },

  stepCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    border: "2px dashed #ccc",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "18px",
  },

  stepLabel: {
    fontSize: "11px",
    textAlign: "center",
  },

  subLabel: {
    fontSize: "10px",
    color: "#888",
    textAlign: "center",
  },
};
export default CentralizationDashboard;
