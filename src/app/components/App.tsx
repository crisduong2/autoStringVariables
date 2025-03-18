import React, { useState } from 'react';
import logo from '../assets/logo.svg';
import '../styles/ui.css';
import ConnectorTab from './ConnectorTab';
import ScreenPreviewTab from './ScreenPreviewTab';

function App() {
  const [activeTab, setActiveTab] = useState('preview');

  return (
    <div>
      <img src={logo} />
      <div className="tabs">
        <button 
          className={activeTab === 'preview' ? 'active' : ''} 
          onClick={() => setActiveTab('preview')}
        >
          Screen Preview
        </button>
        <button 
          className={activeTab === 'connector' ? 'active' : ''} 
          onClick={() => setActiveTab('connector')}
        >
          Screen Connector
        </button>
      </div>

      {activeTab === 'preview' ? (
        <ScreenPreviewTab />
      ) : (
        <ConnectorTab />
      )}
    </div>
  );
}

export default App;
