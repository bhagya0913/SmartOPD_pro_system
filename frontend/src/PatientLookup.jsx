import React, { useState } from 'react';
import { Search, ScanBarcode, CreditCard, X } from 'lucide-react';
import './PatientLookup.css';

const mockPatients = [
  { id: 'PAT001234', name: 'John Doe', nic: '199012345678', dob: '1990-05-15', age: 35, gender: 'Male' },
  { id: 'PAT005678', name: 'Jane Doe', nic: '199012345678', dob: '2015-08-22', age: 10, gender: 'Female' },
  { id: 'PAT009012', name: 'Robert Silva', nic: '198506123456', dob: '1985-06-10', age: 40, gender: 'Male' },
];

export default function PatientLookup({ onSelectPatient, onClose }) {
  const [searchType, setSearchType] = useState('barcode');
  const [searchValue, setSearchValue] = useState('');
  const [foundPatients, setFoundPatients] = useState([]);
  const [scanning, setScanning] = useState(false);

  const handleSearch = () => {
    if (!searchValue.trim()) return;
    let results = mockPatients.filter(p => 
      searchType === 'barcode' 
        ? p.id.toLowerCase().includes(searchValue.toLowerCase())
        : p.nic === searchValue
    );
    setFoundPatients(results);
  };

  const simulateBarcodeScanner = () => {
    setScanning(true);
    setTimeout(() => {
      setSearchValue('PAT001234');
      setScanning(false);
      setFoundPatients(mockPatients.filter(p => p.id === 'PAT001234'));
    }, 1500);
  };

  return (
    <div className="lookup-overlay">
      <div className="lookup-modal">
        <div className="lookup-header">
          <h2 style={{margin: 0}}>Patient Lookup</h2>
          <button onClick={onClose} style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer'}}>
            <X size={24} />
          </button>
        </div>

        <div className="lookup-content">
          <div className="toggle-group">
            <button 
              className={`toggle-btn ${searchType === 'barcode' ? 'toggle-active' : 'toggle-inactive'}`}
              onClick={() => setSearchType('barcode')}
            >
              <ScanBarcode size={18} /> PAT Code
            </button>
            <button 
              className={`toggle-btn ${searchType === 'nic' ? 'toggle-active' : 'toggle-inactive'}`}
              onClick={() => setSearchType('nic')}
            >
              <CreditCard size={18} /> NIC Number
            </button>
          </div>

          <div className="search-row">
            <input
              type="text"
              className="reg-input" /* Reusing your existing input style */
              placeholder={searchType === 'barcode' ? 'e.g. PAT001234' : 'e.g. 199012345678'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <button onClick={handleSearch} className="btn-reg-action" style={{width: '120px'}}>Search</button>
          </div>

          {searchType === 'barcode' && (
            <button className="scan-btn" onClick={simulateBarcodeScanner} disabled={scanning}>
               {scanning ? 'Scanning...' : 'Simulate Hardware Scanner'}
            </button>
          )}

          <div style={{marginTop: '1.5rem'}}>
            {foundPatients.map(patient => (
              <div key={patient.id} className="patient-result-card" onClick={() => onSelectPatient(patient)}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <h4 style={{margin: '0 0 5px 0'}}>{patient.name}</h4>
                  <span style={{fontSize: '12px', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px'}}>{patient.id}</span>
                </div>
                <div style={{display: 'flex', gap: '20px', fontSize: '14px', color: '#6b7280'}}>
                  <span>NIC: {patient.nic}</span>
                  <span>Age: {patient.age}</span>
                  <span>Gender: {patient.gender}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}