/**
 * BlockSmith Plugin for Blockbench
 * Integrates with BlockSmith API to generate models
 */
try {
    (function() {
        console.log('Starting plugin initialization...');
        console.log('[BlockSmith] plugin file evaluated');
    
        const plugin = {
            id: 'blocksmith_plugin',
            name: 'BlockSmith Integration',
            author: 'Blocksmith',
            version: '1.0.0',
            description: 'Generate models using BlockSmith API',
            icon: 'fa-cube', // Font Awesome cube icon
            variant: 'both'
        };
    
        const API_BASE = 'http://localhost:8000/api/v0'; // Replace with your backend URL
        let apiKey = localStorage.getItem('blocksmith_api_key') || '';
        let dialog;
    
        // -------------------------------------------
        // Helper: global overlay progress bar (used when Bar is undefined and for load)
        // -------------------------------------------
        function createOverlayProgressBar(labelText = 'Working...') {
            const overlay = document.createElement('div');
            overlay.id = `blocksmith_overlay_${Date.now()}`;
            Object.assign(overlay.style, {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000
            });
    
            const box = document.createElement('div');
            Object.assign(box.style, {
                background: '#222',
                color: '#fff',
                padding: '20px 30px',
                borderRadius: '8px',
                width: '320px',
                textAlign: 'center',
                fontFamily: 'sans-serif'
            });
    
            const text = document.createElement('div');
            text.textContent = `${labelText} 0%`;
    
            const barContainer = document.createElement('div');
            Object.assign(barContainer.style, {
                background: '#555',
                height: '8px',
                borderRadius: '4px',
                marginTop: '12px'
            });
    
            const fill = document.createElement('div');
            Object.assign(fill.style, {
                background: '#0a84ff',
                height: '100%',
                width: '0%',
                borderRadius: '4px'
            });
    
            barContainer.appendChild(fill);
            box.appendChild(text);
            box.appendChild(barContainer);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
    
            return {
                set: (pct) => {
                    fill.style.width = pct + '%';
                    text.textContent = `${labelText} ${pct}%`;
                },
                remove: () => overlay.remove()
            };
        }
    
        // ---------------------- Panel Implementation ----------------------
        let blocksmithPanel;
        let panelVisible = false;
    
        function initBlocksmithPanel() {
            if (typeof Panel === 'undefined') {
                // Fallback for older Blockbench versions: just show the generate dialog directly
                console.warn('[BlockSmith] Panel API not available, falling back to dialogs');
                showLegacyGenerateDialog();
                return;
            }
    
            if (blocksmithPanel) return;
            blocksmithPanel = new Panel('blocksmith_panel', {
                name: 'BlockSmith',
                icon: plugin.icon,
                default_position: 'right',
                onResize: buildPanelContent
            });
            
            // Delay content building to ensure container is ready
            setTimeout(() => {
                buildPanelContent();
                // Try again if it didn't work the first time
                const contentElement = blocksmithPanel?.container || blocksmithPanel?.body || blocksmithPanel?.node;
                if (!contentElement || !contentElement.innerHTML.includes('bs_tabs')) {
                    console.log('[BlockSmith] First attempt failed, retrying...');
                    setTimeout(() => buildPanelContent(), 200);
                }
            }, 100);
        }
    
        function toggleBlocksmithPanel() {
            if (!blocksmithPanel) {
                initBlocksmithPanel();
                panelVisible = true;
                // Force show the panel after initialization
                setTimeout(() => {
                    if (blocksmithPanel && typeof blocksmithPanel.show === 'function') {
                        blocksmithPanel.show();
                    }
                }, 150);
                return;
            }
            panelVisible = !panelVisible;
            if (panelVisible) {
                if (typeof blocksmithPanel.show === 'function') {
                    blocksmithPanel.show();
                } else if (blocksmithPanel.container && blocksmithPanel.container.parentElement) {
                    blocksmithPanel.container.parentElement.style.display = '';
                }
            } else {
                if (typeof blocksmithPanel.hide === 'function') {
                    blocksmithPanel.hide();
                } else if (blocksmithPanel.container && blocksmithPanel.container.parentElement) {
                    blocksmithPanel.container.parentElement.style.display = 'none';
                }
            }
        }
    
        function buildPanelContent() {
            console.log('[BlockSmith] buildPanelContent called', {
                panel: !!blocksmithPanel,
                container: !!blocksmithPanel?.container,
                body: !!blocksmithPanel?.body
            });
            
            // Try different properties for the panel content area
            let contentElement = null;
            if (blocksmithPanel?.container) {
                contentElement = blocksmithPanel.container;
            } else if (blocksmithPanel?.body) {
                contentElement = blocksmithPanel.body;
            } else if (blocksmithPanel?.node) {
                contentElement = blocksmithPanel.node;
            }
            
            if (!blocksmithPanel || !contentElement) {
                console.log('[BlockSmith] Panel or content element not ready, skipping content build');
                return;
            }
            
            console.log('[BlockSmith] Setting content innerHTML using:', contentElement);
            
            // Find or create the content area, preserving the panel header
            let contentArea = contentElement.querySelector('.blocksmith-content');
            if (!contentArea) {
                contentArea = document.createElement('div');
                contentArea.className = 'blocksmith-content';
                contentArea.style.cssText = 'padding: 8px; height: calc(100% - 16px); overflow: auto;';
                contentElement.appendChild(contentArea);
            }
            
            contentArea.innerHTML = `
                <style>
                    #bs_tabs{display:flex;border-bottom:1px solid #444;margin-bottom:8px}
                    #bs_tabs button{flex:1;padding:6px;background:#222;border:none;color:#ccc;font-weight:bold;cursor:pointer}
                    #bs_tabs button.active{background:#0a84ff;color:#fff}
                    #bs_body{padding:0;overflow:auto;}
                    #bs_body input[type=text],#bs_body input[type=number]{width:100%;box-sizing:border-box;margin-bottom:6px}
                    .bs_credit_info{background:#333;padding:8px;border-radius:4px;margin-bottom:8px;font-size:12px}
                    .bs_credit_amount{color:#4CAF50;font-weight:bold}
                    .bs_button{background:#0a84ff;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;margin-top:8px}
                    .bs_button:hover{background:#0066cc}
                    .bs_success{color:#4CAF50;font-size:12px;margin-top:4px}
                    .bs_error{color:#f44336;font-size:12px;margin-top:4px}
                </style>
                <div id="bs_tabs">
                   <button id="bs_tab_generate" class="active">Generate</button>
                   <button id="bs_tab_list">My Models</button>
                   <button id="bs_tab_settings">Settings</button>
                </div>
                <div id="bs_body"></div>
            `;
            contentArea.querySelector('#bs_tab_generate').onclick = ()=> switchTab('generate');
            contentArea.querySelector('#bs_tab_list').onclick    = ()=> switchTab('list');
            contentArea.querySelector('#bs_tab_settings').onclick = ()=> switchTab('settings');
            switchTab('generate');
        }
    
        function switchTab(name){
            const genBtn=document.getElementById('bs_tab_generate');
            const listBtn=document.getElementById('bs_tab_list');
            const settingsBtn=document.getElementById('bs_tab_settings');
            if(!genBtn||!listBtn||!settingsBtn)return;
            genBtn.classList.toggle('active',name==='generate');
            listBtn.classList.toggle('active',name==='list');
            settingsBtn.classList.toggle('active',name==='settings');
            if(name==='generate')buildGenerateTab();
            else if(name==='list')buildListTab();
            else if(name==='settings')buildSettingsTab();
        }
    
        function buildGenerateTab(){
            const body=document.getElementById('bs_body');
            if(!body)return;
            
            // Show API key status
            const apiKeyStatus = apiKey ? 
                `<div class="bs_credit_info">API Key: ${apiKey.substring(0,8)}... ✅</div>` :
                `<div class="bs_error">⚠️ No API key set. Go to Settings tab to add your API key.</div>`;
            
            body.innerHTML=`
                ${apiKeyStatus}
                <label>Prompt <input id="bs_prompt" type="text" placeholder="Make me a llama"></label>
                <button id="bs_generate_btn" class="bs_button" ${!apiKey ? 'disabled' : ''}>Generate 🚀</button>
            `;
            
            if(apiKey) {
                document.getElementById('bs_generate_btn').onclick=()=>{
                    const formResult={
                        api_key: apiKey,
                        prompt: document.getElementById('bs_prompt').value
                    };
                    generateModel(formResult);
                };
            }
        }
    
        function buildListTab(){
            const body=document.getElementById('bs_body');
            if(!body)return;
            body.innerHTML=`
                <select id="bs_status_filter">
                    <option value="">All</option>
                    <option value="completed" selected>Completed</option>
                    <option value="processing">Processing</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                </select>
                <button id="bs_refresh_btn">Refresh</button>
                <div id="blocksmith_model_list" style="margin-top:10px; max-height:400px; overflow:auto;"></div>
            `;
            document.getElementById('bs_refresh_btn').onclick=()=>{
                const fakeDialog={getFormResult:()=>({status_filter:document.getElementById('bs_status_filter').value})};
                refreshModelList(fakeDialog);
            };
            document.getElementById('bs_refresh_btn').click();
        }

        function buildSettingsTab(){
            const body=document.getElementById('bs_body');
            if(!body)return;
            body.innerHTML=`
                <div class="bs_credit_info">
                    <div>💳 Credits: <span id="bs_credits_display" class="bs_credit_amount">Loading...</span></div>
                    <div>🔒 Reserved: <span id="bs_reserved_display">-</span></div>
                    <div>✅ Available: <span id="bs_available_display">-</span></div>
                    <button id="bs_refresh_credits" class="bs_button" style="margin-top:8px;">Refresh Credits</button>
                </div>
                
                <label>API Key</label>
                <input id="bs_settings_api_key" type="text" value="${apiKey||''}" placeholder="Enter your BlockSmith API key">
                <button id="bs_update_api_key" class="bs_button">Update API Key</button>
                <div id="bs_api_key_status"></div>
                
                <div style="margin-top:16px; padding:8px; background:#2a2a2a; border-radius:4px; font-size:12px;">
                    <strong>💡 How to get an API key:</strong><br>
                    Contact your BlockSmith administrator or check your account dashboard.
                </div>
            `;
            
            // Load credits on tab open
            loadCredits();
            
            // Set up event handlers
            document.getElementById('bs_refresh_credits').onclick = () => loadCredits();
            document.getElementById('bs_update_api_key').onclick = () => updateApiKey();
        }

        async function loadCredits() {
            const creditsDisplay = document.getElementById('bs_credits_display');
            const reservedDisplay = document.getElementById('bs_reserved_display');
            const availableDisplay = document.getElementById('bs_available_display');
            
            if (!apiKey) {
                creditsDisplay.textContent = 'No API key';
                reservedDisplay.textContent = '-';
                availableDisplay.textContent = '-';
                return;
            }
            
            try {
                creditsDisplay.textContent = 'Loading...';
                const response = await apiCall('credits', 'GET');
                const data = await response.json();
                
                creditsDisplay.textContent = data.credits.toFixed(1);
                reservedDisplay.textContent = data.reserved_credits.toFixed(1);
                availableDisplay.textContent = data.available_credits.toFixed(1);
                
                // Update display color based on available credits
                if (data.available_credits <= 0) {
                    availableDisplay.style.color = '#f44336';
                } else if (data.available_credits < 2) {
                    availableDisplay.style.color = '#ff9800';
                } else {
                    availableDisplay.style.color = '#4CAF50';
                }
                
            } catch (error) {
                creditsDisplay.textContent = 'Error';
                reservedDisplay.textContent = '-';
                availableDisplay.textContent = '-';
                console.error('Failed to load credits:', error);
                
                // Re-throw the error so testApiKeyAndLoadCredits can catch it
                throw error;
            }
        }

        function updateApiKey() {
            const newApiKey = document.getElementById('bs_settings_api_key').value.trim();
            const statusDiv = document.getElementById('bs_api_key_status');
            
            if (!newApiKey) {
                statusDiv.innerHTML = '<div class="bs_error">Please enter an API key</div>';
                return;
            }
            
            // Update the global API key
            apiKey = newApiKey;
            localStorage.setItem('blocksmith_api_key', apiKey);
            
            // Show success message
            statusDiv.innerHTML = '<div class="bs_success">✅ API key updated and saved locally!</div>';
            
            // Test the new key by loading credits (but handle errors gracefully)
            testApiKeyAndLoadCredits(statusDiv);
            
            // Clear status after 5 seconds
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 5000);
        }

        async function testApiKeyAndLoadCredits(statusDiv) {
            try {
                await loadCredits();
                // If loadCredits succeeds, update the status
                statusDiv.innerHTML = '<div class="bs_success">✅ API key updated and verified! Credits loaded.</div>';
            } catch (error) {
                // If loadCredits fails, show a helpful error but don't revert the API key
                statusDiv.innerHTML = '<div class="bs_error">⚠️ API key saved, but verification failed. Please check the key is correct.</div>';
                console.error('API key verification failed:', error);
            }
        }
    
        async function refreshModelList(loadDialog) {
            const listContainer = document.getElementById('blocksmith_model_list');
            if (!listContainer) return;
    
            listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading models...</div>';
    
            try {
                const formData = loadDialog.getFormResult();
                const statusFilter = formData.status_filter || '';
                
                const queryParams = new URLSearchParams({
                    limit: '50'
                });
                if (statusFilter) {
                    queryParams.append('status', statusFilter);
                }
    
                const response = await apiCall(`models?${queryParams}`, 'GET');
                const data = await response.json();
    
                if (data.models.length === 0) {
                    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No models found</div>';
                    return;
                }
    
                // Build model list HTML
                let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
                data.models.forEach(model => {
                    const statusColor = model.status === 'completed' ? '#4CAF50' : 
                                      model.status === 'failed' ? '#F44336' : 
                                      model.status === 'processing' ? '#FF9800' : '#9E9E9E';
                    
                    const canLoad = model.status === 'completed' && model.has_bbmodel;
                    const date = new Date(model.created_at).toLocaleDateString();
                    
                    html += `
                        <div style="border: 1px solid #333; border-radius: 4px; padding: 12px; background: #2a2a2a;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: bold; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${model.prompt}">
                                        ${model.prompt}
                                    </div>
                                    <div style="font-size: 12px; color: #888;">
                                        ${date} • ${model.credits_used} credits • 
                                        <span style="color: ${statusColor};">${model.status}</span>
                                    </div>
                                </div>
                                ${canLoad ? `
                                    <button onclick="loadBlockSmithModel('${model.job_id}')" 
                                            style="background: #0a84ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-left: 12px;">
                                        Load
                                    </button>
                                ` : `
                                    <span style="color: #666; font-size: 12px; margin-left: 12px;">
                                        ${!model.has_bbmodel ? 'No file' : 'Cannot load'}
                                    </span>
                                `}
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                
                if (data.has_more) {
                    html += '<div style="text-align: center; padding: 10px; color: #888; font-size: 12px;">Showing first 50 models</div>';
                }
    
                listContainer.innerHTML = html;
            } catch (error) {
                listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #f44336;">Error loading models: ${error.message}</div>`;
            }
        }
    
                // Global function for loading models (called from HTML buttons)
        window.loadBlockSmithModel = async function(jobId) {
            console.log(`Loading model: ${jobId}`);
            
            const bar = (typeof Bar !== 'undefined') ? new Bar('blocksmith_load_progress', {
                label: 'Loading model...',
                min: 0,
                max: 100,
                value: 0
            }) : createOverlayProgressBar();

            try {
                bar.set(25);
                const modelResponse = await apiCall(`model/${jobId}/bbmodel`, 'GET');
                const modelText = await modelResponse.text();
                bar.set(75);

                // First, create a new project with the 'free' format. This sets the
                // necessary context for the parser to work correctly.
                newProject('free');
                
                // The codec expects a parsed JavaScript object.
                const modelData = JSON.parse(modelText);
                Codecs.project.parse(modelData);

                bar.set(100);
                setTimeout(() => bar.remove(), 500);
                Blockbench.showMessageBox({
                    title: 'Success',
                    message: 'Model loaded successfully!'
                });

            } catch (error) {
                bar.remove();
                Blockbench.showMessageBox({
                    title: 'Error',
                    message: `Failed to load model: ${error.message}`
                });
            }
        };
    
        async function apiCall(endpoint, method, body = null) {
            const headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
    
            const options = { method, headers };
            if (body) options.body = JSON.stringify(body);
    
            const response = await fetch(`${API_BASE}/${endpoint}`, options);
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            return response;
        }
    
        async function pollJobStatus(jobId) {
            const maxAttempts = 36; // 3 minutes / 5 seconds = 36 attempts
            const delay = 5000; // 5 seconds
            
            console.log(`Starting to poll job ${jobId} (${maxAttempts} attempts, ${delay/1000}s interval)`);
            
            for (let i = 0; i < maxAttempts; i++) {
                console.log(`Polling attempt ${i + 1}/${maxAttempts} for job ${jobId}`);
                const response = await apiCall(`model/${jobId}`, 'GET');
                const data = await response.json();
                console.log(`Job ${jobId} status:`, data.status);
                
                if (data.status === 'completed') return data;
                if (data.status === 'failed') {
                    const errorMsg = data.error_message || 'Model generation failed';
                    console.error(`Job ${jobId} failed:`, errorMsg);
                    throw new Error(errorMsg);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            throw new Error(`Job timed out after ${maxAttempts * delay / 1000} seconds`);
        }
    
        /**
         * Start a fake progress animation for long-running jobs.
         *
         * The bar increments every 3 s by a small random amount and slows
         * down as it approaches completion, stopping at 99 % until the real
         * job finishes.
         *
         * @param {Object} bar  Instance of Blockbench Bar or overlay bar
         * @returns {Function}  Call to stop the animation and optionally set 100 %
         */
        function startProgressSimulation(bar) {
            let pct = 0;
            bar.set(0);

            // Update every 3 s for progressive feedback
            const interval = setInterval(() => {
                if (pct >= 99) return; // pause at 99 % until we are told to finish

                let inc;
                if (pct < 70) {
                    inc = Math.floor(Math.random() * 3) + 4; // 4–6
                } else if (pct < 90) {
                    inc = Math.floor(Math.random() * 3) + 2; // 2–4
                } else {
                    inc = Math.floor(Math.random() * 2) + 1; // 1–2
                }

                pct = Math.min(pct + inc, 99);
                bar.set(pct);
            }, 3000);

            return (complete = false) => {
                clearInterval(interval);
                if (complete) bar.set(100);
            };
        }

        async function generateModel(form) {
            const enteredKey = (form.api_key ?? '').toString().trim();
            const prompt = (form.prompt ?? '').toString().trim();

            if (!enteredKey) {
                Blockbench.showMessageBox({ title: 'Error', message: 'Please enter a valid API key' });
                return;
            }
            if (!prompt) {
                Blockbench.showMessageBox({ title: 'Error', message: 'Please enter a prompt' });
                return;
            }

            apiKey = enteredKey;
            localStorage.setItem('blocksmith_api_key', apiKey);

            const bar = (typeof Bar !== 'undefined') ? new Bar('blocksmith_progress', {
                label: 'Generating model...', min: 0, max: 100, value: 0
            }) : createOverlayProgressBar();
            const stopProgress = startProgressSimulation(bar);

            try {
                const createResponse = await apiCall('model', 'POST', { prompt });
                const job = await createResponse.json();

                await pollJobStatus(job.job_id);
                const modelResponse = await apiCall(`model/${job.job_id}/bbmodel`, 'GET');
                const modelText = await modelResponse.text();

                stopProgress(true);
                await new Promise(r => setTimeout(r, 200));

                newProject('free');
                const modelData = JSON.parse(modelText);
                Codecs.project.parse(modelData);

                setTimeout(() => bar.remove(), 500);
                Blockbench.showMessageBox({ title: 'Success', message: 'Model loaded successfully!' });

            } catch (error) {
                stopProgress();
                bar.remove();
                Blockbench.showMessageBox({ title: 'Error', message: `Failed to generate model: ${error.message}` });
            }
        }
    
        /** Legacy: generate dialog for Blockbench versions without Panel API */
        function showLegacyGenerateDialog() {
            dialog = new Dialog({
                id: 'blocksmith_dialog',
                title: 'BlockSmith Generator',
                width: 500,
                lines: ['Generate models using BlockSmith API'],
                form: {
                    api_key: { label: 'API Key', type: 'text', value: apiKey, placeholder: 'Enter your BlockSmith API key' },
                    prompt:   { label: 'Prompt',  type: 'text', placeholder: 'e.g., Make me a llama' }
                },
                buttons: {
                    generate: {
                        label: 'Generate', icon: 'fa-cube', click: () => { generateModel(dialog.getFormResult()); dialog.hide(); }
                    },
                    cancel: { label: 'Cancel' }
                },
                onConfirm: () => { generateModel(dialog.getFormResult()); dialog.hide(); }
            });
            dialog.show();
        }

        // -------------------------------------------------------------
        // Register plugin with Blockbench (was accidentally removed)
        // -------------------------------------------------------------
        Plugin.register(plugin.id, {
            title: plugin.name,
            author: plugin.author,
            icon: plugin.icon,
            description: plugin.description,
            version: plugin.version,
            variant: plugin.variant,
            onload() {
                console.log('Registering actions...');

                const panelAction = new Action('blocksmith_panel_toggle', {
                    name: 'BlockSmith Panel',
                    icon: plugin.icon,
                    category: 'edit',
                    click: () => toggleBlocksmithPanel()
                });

                // Remove any previous (hot-reload) action, then add
                MenuBar.removeAction('tools.blocksmith_panel_toggle');
                MenuBar.removeAction('filter.blocksmith_panel_toggle');

                // Try adding to 'tools' first, then fallback to 'filter' for older versions
                try {
                    MenuBar.addAction(panelAction, 'tools');
                } catch (e) {
                    // Fallback for older Blockbench builds that use 'filter' as root menu group
                    MenuBar.addAction(panelAction, 'filter');
                }

                console.log('Registered action: BlockSmith Panel');

                // Optionally auto-open the panel once on first load
                // initBlocksmithPanel();
            },
            onunload() {
                console.log('Unloading BlockSmith plugin...');
                MenuBar.removeAction('tools.blocksmith_panel_toggle');
                MenuBar.removeAction('filter.blocksmith_panel_toggle');
                if (blocksmithPanel) blocksmithPanel.delete();
            }
        });
    })();    
} catch (error) {
    console.error('Error in plugin initialization:', error);
}