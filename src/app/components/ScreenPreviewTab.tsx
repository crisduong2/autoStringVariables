import React, { useState, useEffect } from 'react';
import '../styles/ui.css';
import { analyzeImage } from '../utils/gemini';

interface SelectedScreen {
  id: string;
  name: string;
  frameName: string;
  imageUrl?: string;
}

interface TranslationEntry {
  variableName: string;
  fullVariableName: string;
  en: string;
  vi: string;
  screenName?: string;
  selected: boolean;
}

const ScreenPreviewTab = () => {
  const [selectedScreens, setSelectedScreens] = useState<SelectedScreen[]>([]);
  const [activeScreenIndex, setActiveScreenIndex] = useState<number>(0);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingVariables, setIsCreatingVariables] = useState(false);

  const handleScreenSelect = () => {
    parent.postMessage({ pluginMessage: { type: 'get-selected-screen-with-image' } }, '*');
  };

  const handleDownload = (screen: SelectedScreen) => {
    if (screen.imageUrl) {
      const link = document.createElement('a');
      link.href = screen.imageUrl;
      link.download = `${screen.name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCreateVariables = () => {
    setIsCreatingVariables(true);
    const variablesToCreate = translations
      .filter(t => t.selected)
      .map(t => ({
        name: t.variableName,
        fullName: t.fullVariableName,
        en: t.en,
        vi: t.vi,
        screenName: t.screenName
      }));

    console.log('Variables being sent to Figma:', JSON.stringify(variablesToCreate, null, 2));
    
    parent.postMessage({
      pluginMessage: {
        type: 'create-variables',
        variables: variablesToCreate
      }
    }, '*');
  };

  const handleTranslationChange = (index: number, field: 'variableName' | 'en' | 'vi', value: string) => {
    const updatedTranslations = [...translations];
    updatedTranslations[index] = {
      ...updatedTranslations[index],
      [field]: value,
      fullVariableName: field === 'variableName' ? `${value}::body` : updatedTranslations[index].fullVariableName
    };
    setTranslations(updatedTranslations);
  };

  const handleCheckboxChange = (index: number) => {
    const updatedTranslations = [...translations];
    updatedTranslations[index] = {
      ...updatedTranslations[index],
      selected: !updatedTranslations[index].selected
    };
    setTranslations(updatedTranslations);
  };

  const handleSelectAll = (checked: boolean) => {
    const updatedTranslations = translations.map(t => ({
      ...t,
      selected: checked
    }));
    setTranslations(updatedTranslations);
  };

  const parseGeminiResponse = (response: string, screen: SelectedScreen): TranslationEntry[] => {
    try {
      console.log('Response before cleaning:', response);
      // First remove the markdown code block markers
      let cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
      
      // Fix the malformed keys by:
      // 1. Finding all occurrences of keys with ::
      // 2. Removing the extra quote between the path and type
      cleanJson = cleanJson.replace(/"([^"]+)::"([^"]+)"/g, '"$1::$2"');
      
      console.log('Cleaned JSON:', cleanJson);
      const jsonResponse = JSON.parse(cleanJson);
      console.log('Parsed JSON:', jsonResponse);
      
      return Object.entries(jsonResponse).map(([key, value]: [string, any]) => {
        // Use the frame name from the selected screen for the variable name prefix
        const frameName = screen.name; // This is the frame name from Figma API
        const variableName = `${frameName}/${key}`;
        
        return {
          variableName: variableName,
          fullVariableName: variableName,
          en: value.en,
          vi: value.vn, // Note: API returns 'vn' but we store as 'vi'
          screenName: frameName, // Use the frame name for display in the table
          selected: true
        };
      });
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Full response:', response);
      setError('Failed to parse analysis results. Please try again.');
      return [];
    }
  };

  const handleAnalyzeImage = async () => {
    if (selectedScreens.length === 0) return;

    try {
      setIsAnalyzing(true);
      setError(null);
      
      const allTranslations: TranslationEntry[] = [];
      
      for (const screen of selectedScreens) {
        if (!screen.imageUrl) continue;
        
        const base64Data = screen.imageUrl.split(',')[1];
        const analysis = await analyzeImage(base64Data);
        const parsedTranslations = parseGeminiResponse(analysis, screen);
        allTranslations.push(...parsedTranslations);
      }

      setTranslations(allTranslations);
    } catch (error) {
      console.error('Error analyzing images:', error);
      setError('Failed to analyze images. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    window.onmessage = async (event) => {
      const message = event.data.pluginMessage;
      if (message.type === 'selected-screens-with-images') {
        setSelectedScreens(message.screens);
        setActiveScreenIndex(0);
        setTranslations([]);
        setError(null);
      } else if (message.type === 'variables-created') {
        setIsCreatingVariables(false);
      }
    };
  }, []);

  return (
    <div className="screen-preview-tab">
      <h2>Screen Preview</h2>
      <div className="preview-container">
        {selectedScreens.length > 0 ? (
          <>
            <div className="screens-navigation">
              {selectedScreens.map((screen, index) => (
                <button
                  key={screen.id}
                  onClick={() => setActiveScreenIndex(index)}
                  className={`screen-tab ${index === activeScreenIndex ? 'active' : ''}`}
                >
                  {screen.name}
                </button>
              ))}
            </div>
            <div className="screen-info">
              <span className="screen-name">{selectedScreens[activeScreenIndex].name}</span>
              <span className="screen-id">({selectedScreens[activeScreenIndex].id})</span>
            </div>
            {selectedScreens[activeScreenIndex].imageUrl && (
              <>
                <div className="image-container">
                  <img 
                    src={selectedScreens[activeScreenIndex].imageUrl} 
                    alt={selectedScreens[activeScreenIndex].name}
                    className="screen-preview-image"
                  />
                </div>
                <div className="action-buttons">
                  <button 
                    onClick={() => handleDownload(selectedScreens[activeScreenIndex])}
                    className="secondary-button"
                    title="Download PNG"
                  >
                    <span className="button-icon">⬇️</span> Download
                  </button>
                  <button 
                    onClick={handleAnalyzeImage}
                    className="secondary-button"
                    title="Analyze All Screens"
                    disabled={isAnalyzing}
                  >
                    <span className="button-icon">🔍</span> 
                    {isAnalyzing ? 'Analyzing...' : 'Analyze All Screens'}
                  </button>
                </div>
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                {translations.length > 0 && (
                  <div className="analysis-result">
                    <h3>Translation Table</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                checked={translations.every(t => t.selected)}
                                className="checkbox-input"
                              />
                            </th>
                            <th>Screen</th>
                            <th>Variable Name</th>
                            <th>EN</th>
                            <th>VI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {translations.map((entry, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={entry.selected}
                                  onChange={() => handleCheckboxChange(index)}
                                  className="checkbox-input"
                                />
                              </td>
                              <td>{entry.screenName}</td>
                              <td>
                                <input
                                  type="text"
                                  value={entry.variableName}
                                  onChange={(e) => handleTranslationChange(index, 'variableName', e.target.value)}
                                  className="table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={entry.en}
                                  onChange={(e) => handleTranslationChange(index, 'en', e.target.value)}
                                  className="table-input"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={entry.vi}
                                  onChange={(e) => handleTranslationChange(index, 'vi', e.target.value)}
                                  className="table-input"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleCreateVariables}
                      className="primary-button create-variables-button"
                      disabled={isCreatingVariables || !translations.some(t => t.selected)}
                    >
                      <span className="button-icon">🔧</span>
                      {isCreatingVariables ? 'Creating Variables...' : 'Create Figma Variables'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="empty-state">
            No screens selected
          </div>
        )}
      </div>
      <button 
        onClick={handleScreenSelect}
        className="primary-button"
      >
        Select Screens
      </button>
    </div>
  );
};

export default ScreenPreviewTab; 