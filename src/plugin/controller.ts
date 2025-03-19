// Show the plugin UI with increased dimensions
figma.showUI(__html__, {
  width: 1000,
  height: 500,
  title: "Screen Preview & Analysis"
});

// Handle messages from the UI
figma.ui.onmessage = async msg => {
  if (msg.type === 'get-selected-screen-with-image') {
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
      // Process all selected nodes that are valid screens
      const validScreens = selection.filter(node => 
        node.type === 'FRAME' || 
        node.type === 'COMPONENT' || 
        node.type === 'INSTANCE'
      );

      if (validScreens.length === 0) {
        figma.notify('Please select at least one screen (Frame, Component, or Instance)');
        return;
      }

      // Process each valid screen
      Promise.all(validScreens.map(async (screen) => {
        try {
          const imageData = await screen.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 2 }
          });
          
          // Get the parent frame name if it exists, otherwise use the screen name
          let frameName = screen.name;
          
          // If the screen is not a frame itself, try to find its parent frame
          if (screen.type !== 'FRAME') {
            let parent = screen.parent;
            while (parent && parent.type !== 'FRAME' && parent.type !== 'PAGE') {
              parent = parent.parent;
            }
            if (parent && parent.type === 'FRAME') {
              frameName = parent.name;
            }
          }
          
          const base64Image = figma.base64Encode(imageData);
          return {
            nodeId: screen.id,
            name: frameName, // Use the frame name here
            imageUrl: `data:image/png;base64,${base64Image}`
          };
        } catch (error) {
          console.error(`Error processing screen ${screen.name}:`, error);
          return null;
        }
      })).then(screens => {
        // Filter out any failed exports
        const validScreenData = screens.filter(screen => screen !== null);
        
        if (validScreenData.length > 0) {
          figma.ui.postMessage({ 
            type: 'selected-screens-with-images',
            screens: validScreenData
          });
        } else {
          figma.notify('Failed to process any selected screens');
        }
      });
    } else {
      figma.notify('Please select at least one screen');
    }
  }

  if (msg.type === 'copy-screen') {
    try {
      const node = figma.getNodeById(msg.nodeId);
      if (node && 'type' in node && (
        node.type === 'FRAME' || 
        node.type === 'COMPONENT' || 
        node.type === 'COMPONENT_SET' ||
        node.type === 'INSTANCE'
      )) {
        figma.currentPage.selection = [node];
        figma.notify('Screen selected. Use Cmd/Ctrl + C to copy');
      } else {
        figma.notify('Could not find the selected screen or invalid type', { error: true });
      }
    } catch (error) {
      console.error('Error copying screen:', error);
      figma.notify('Failed to copy screen', { error: true });
    }
  }

  if (msg.type === 'get-selected-node') {
    const selection = figma.currentPage.selection;
    if (selection.length === 1) {
      const selectedNode = selection[0];
      
      // Check if the selected node is a frame, component, or instance
      if (selectedNode.type === 'FRAME' || 
          selectedNode.type === 'COMPONENT' || 
          selectedNode.type === 'INSTANCE') {
    figma.ui.postMessage({
          type: 'selected-node',
          nodeId: selectedNode.id,
          nodeName: selectedNode.name // Include node name for better identification
        });
      } else {
        figma.notify('Please select a screen (Frame, Component, or Instance)');
      }
    } else {
      figma.notify('Please select exactly one screen');
    }
  }

  if (msg.type === 'create-connector') {
    const { screenIds } = msg;
    if (screenIds.length !== 2) {
      figma.notify('Please select exactly 2 screens');
      return;
    }

    try {
      const screen1 = figma.getNodeById(screenIds[0]);
      const screen2 = figma.getNodeById(screenIds[1]);

      // Verify that both nodes exist and are the correct type
      if (!screen1 || !screen2 || 
          !['FRAME', 'COMPONENT', 'INSTANCE'].includes(screen1.type) ||
          !['FRAME', 'COMPONENT', 'INSTANCE'].includes(screen2.type)) {
        figma.notify('Please select valid screens');
        return;
      }

      // Type assertion after verification
      const screen1Node = screen1 as FrameNode | ComponentNode | InstanceNode;
      const screen2Node = screen2 as FrameNode | ComponentNode | InstanceNode;

      // Create a line (vector) to connect the screens
      const line = figma.createVector();
      
      // Calculate the center points of both screens
      const screen1Center = {
        x: screen1Node.x + screen1Node.width / 2,
        y: screen1Node.y + screen1Node.height / 2
      };
      
      const screen2Center = {
        x: screen2Node.x + screen2Node.width / 2,
        y: screen2Node.y + screen2Node.height / 2
      };

      // Set the line's stroke properties
      line.strokes = [{
        type: 'SOLID',
        color: { r: 0.129, g: 0.463, b: 1 } // Blue color (#2175FF)
      }];
      line.strokeWeight = 2;

      // Create the path for the line
      line.vectorNetwork = {
        vertices: [
          { x: screen1Center.x, y: screen1Center.y },
          { x: screen2Center.x, y: screen2Center.y }
        ],
        segments: [
          {
            start: 0,
            end: 1
          }
        ]
      };

      // Add arrow at the end
      const arrowSize = 12;
      const dx = screen2Center.x - screen1Center.x;
      const dy = screen2Center.y - screen1Center.y;
      const angle = Math.atan2(dy, dx);
      
      const arrow = figma.createVector();
      arrow.strokes = [{
        type: 'SOLID',
        color: { r: 0.129, g: 0.463, b: 1 } // Blue color (#2175FF)
      }];
      arrow.strokeWeight = 2;
      
      arrow.vectorNetwork = {
        vertices: [
          { x: screen2Center.x - arrowSize * Math.cos(angle - Math.PI/6), 
            y: screen2Center.y - arrowSize * Math.sin(angle - Math.PI/6) },
          { x: screen2Center.x, y: screen2Center.y },
          { x: screen2Center.x - arrowSize * Math.cos(angle + Math.PI/6),
            y: screen2Center.y - arrowSize * Math.sin(angle + Math.PI/6) }
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 }
        ]
      };

      // Group the line and arrow
      const group = figma.group([line, arrow], figma.currentPage);
      group.name = `Connection: ${screen1Node.name} → ${screen2Node.name}`;

      figma.currentPage.appendChild(group);
      figma.notify('Connection created successfully!');
    } catch (error) {
      figma.notify('Error creating connection: ' + error.message);
    }
  }

  if (msg.type === 'create-variables') {
    try {
      // Check if variables API is available
      if (!('variables' in figma)) {
        throw new Error('Variables API is not available in this version of Figma');
      }

      // Type assertion for the variables API
      const variablesAPI = (figma as any).variables;

      console.log('Received variables data:', JSON.stringify(msg.variables, null, 2));

      // Create a collection for translations if it doesn't exist
      const collections = variablesAPI.getLocalVariableCollections();
      let collection = collections.find(c => c.name === 'Translations');
      
      if (!collection) {
        // Create a new collection - this will have a default "Mode 1" added automatically
        collection = variablesAPI.createVariableCollection('Translations');
        
        // Remove the default "Mode 1" and add the modes we need
        collection.modes[0].name = 'vi';
        collection.addMode('en', 'English');
        
        // Ensure only three modes exist
        collection.modes = collection.modes.slice(0, 2);

        console.log('New collection created with modes:', {
          collection: collection.name,
          modes: collection.modes.map(m => ({ id: m.modeId, name: m.name }))
        });
      }
      
      // Get the mode IDs by name - we want "vi" and "en" modes
      const viMode = collection.modes.find(m => m.name === 'Vietnamese' || m.name === 'vi')?.modeId;
      const enMode = collection.modes.find(m => m.name === 'English' || m.name === 'en')?.modeId;
      
      // If we can't find our modes, try to use whatever modes are available
      if (!viMode || !enMode) {
        console.warn('Could not find expected modes. Using available modes instead.');
        
        if (collection.modes.length < 2) {
          throw new Error('Collection does not have enough modes for translations');
        }
        
        // Use the first two available modes
        const modeIds = collection.modes.map(m => m.modeId);
        
        // Create variables for each translation
        for (const variable of msg.variables) {
          try {
            const newVar = variablesAPI.createVariable(
              variable.fullName || variable.name,
              collection.id,
              'STRING'
            );
            
            // Set values for whatever modes are available
            newVar.setValueForMode(modeIds[0], variable.vi);
            newVar.setValueForMode(modeIds[1], variable.en);
            
            console.log('Variable created with fallback modes:', {
              name: newVar.name,
              id: newVar.id
            });
          } catch (varError) {
            console.error(`Error creating variable ${variable.name || variable.fullName}:`, varError);
          }
        }
      } else {
        // Create variables using our expected modes
        for (const variable of msg.variables) {
          try {
            const newVar = variablesAPI.createVariable(
              variable.fullName || variable.name,
              collection.id,
              'STRING'
            );

            // Set the values for each mode
            newVar.setValueForMode(viMode, variable.vi);
            newVar.setValueForMode(enMode, variable.en);

            console.log('Variable created successfully:', {
              name: newVar.name,
              id: newVar.id,
              screenName: variable.screenName
            });
          } catch (varError) {
            console.error(`Error creating variable ${variable.name || variable.fullName}:`, varError);
          }
        }
      }

      figma.notify('Variables created successfully!');
      figma.ui.postMessage({ type: 'variables-created' });
    } catch (error) {
      console.error('Error creating variables:', error);
      figma.notify('Failed to create variables: ' + (error as Error).message, { error: true });
    }
  }

  if (msg.type === 'cancel') {
  figma.closePlugin();
  }
};
