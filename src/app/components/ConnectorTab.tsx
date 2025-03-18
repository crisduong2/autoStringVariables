import React, { useState } from 'react';
import '../styles/ui.css';

interface SelectedScreen {
  id: string;
  name: string;
}

const ConnectorTab = () => {
  const [selectedScreens, setSelectedScreens] = useState<SelectedScreen[]>([]);

  const handleScreenSelect = () => {
    // Send message to plugin code to get selected node
    parent.postMessage({ pluginMessage: { type: 'get-selected-node' } }, '*');
  };

  const handleCreateConnector = () => {
    if (selectedScreens.length !== 2) {
      console.error('Please select exactly 2 screens');
      return;
    }
    
    // Send message to plugin code to create connector
    parent.postMessage({ 
      pluginMessage: { 
        type: 'create-connector',
        screenIds: selectedScreens.map(screen => screen.id)
      }
    }, '*');
  };

  // Listen for messages from the plugin code
  React.useEffect(() => {
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (message.type === 'selected-node') {
        if (selectedScreens.length < 2) {
          setSelectedScreens([...selectedScreens, {
            id: message.nodeId,
            name: message.nodeName || 'Unnamed Screen'
          }]);
        }
      }
    };
  }, [selectedScreens]);

  return (
    <div className="connector-tab">
      <h2>Connect Screens</h2>
      <div className="selected-screens">
        <p>Selected Screens: {selectedScreens.length}/2</p>
        {selectedScreens.map((screen, index) => (
          <div key={screen.id} className="screen-item">
            <span className="screen-number">Screen {index + 1}:</span>
            <span className="screen-name">{screen.name}</span>
            <span className="screen-id">({screen.id})</span>
          </div>
        ))}
      </div>
      <button 
        onClick={handleScreenSelect}
        disabled={selectedScreens.length >= 2}
        className="primary-button"
      >
        Select Screen
      </button>
      <button 
        onClick={handleCreateConnector}
        disabled={selectedScreens.length !== 2}
        className="primary-button"
      >
        Create Connector
      </button>
      <button 
        onClick={() => setSelectedScreens([])}
        disabled={selectedScreens.length === 0}
        className="secondary-button"
      >
        Reset Selection
      </button>
    </div>
  );
};

export default ConnectorTab; 