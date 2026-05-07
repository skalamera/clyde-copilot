const fs = require('fs');
let index = fs.readFileSync('src/index.html', 'utf8');

// 1. Add modal CSS
const modalCss = `
        /* Modal Styles */
        #settingsModal {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 2000;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        #settingsModal.show {
            display: flex;
            opacity: 1;
        }

        .modal-content {
            background: var(--background);
            border: 1px solid var(--border);
            padding: 30px;
            border-radius: 12px;
            width: 80%;
            max-width: 800px;
            position: relative;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .modal-close {
            position: absolute;
            top: 15px;
            right: 15px;
            background: transparent;
            border: none;
            color: #94a3b8;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .modal-close:hover {
            color: var(--foreground);
        }

        /* Top Bar */
        #topBar {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 40px;
            -webkit-app-region: drag;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0 20px;
            z-index: 1000;
        }
        
        .topbar-btn {
            -webkit-app-region: no-drag;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid var(--border);
            color: #e2e8f0;
            padding: 5px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.2s;
        }
        
        .topbar-btn:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        #closeAppBtn {
            margin-left: 10px;
            background: transparent;
            color: #94a3b8;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            -webkit-app-region: no-drag;
        }

        #closeAppBtn:hover {
            color: var(--danger);
        }
`;

index = index.replace('</style>', modalCss + '\n    </style>');

// 2. Add Top Bar
const topBarHtml = `
    <div id="topBar">
        <button class="topbar-btn" onclick="document.getElementById('settingsModal').classList.add('show')">Context / Resume</button>
        <button id="closeAppBtn" onclick="window.close()">&times;</button>
    </div>
`;
index = index.replace('<div id="container">', topBarHtml + '\n    <div id="container">');

// 3. Move Context Panel into Modal
const modalHtml = `
    <div id="settingsModal">
        <div class="modal-content glass-panel">
            <button class="modal-close" onclick="document.getElementById('settingsModal').classList.remove('show')">&times;</button>
            <h2 style="margin-top:0;">Context Settings</h2>
            <div class="input-group">
                <label for="jobDescription">Job Description</label>
                <textarea id="jobDescription" placeholder="Paste the job description here to help Clyde tailor its suggestions..."></textarea>
            </div>
            <div class="input-group">
                <label for="resume">My Resume</label>
                <textarea id="resume" placeholder="Paste your resume or background info here..."></textarea>
            </div>
            <button class="topbar-btn" style="align-self: flex-end; padding: 10px 20px;" onclick="document.getElementById('settingsModal').classList.remove('show')">Save & Close</button>
        </div>
    </div>
`;

// Replace existing contextPanel with modalHtml
const contextPanelRegex = /<div id="contextPanel" class="glass-panel">[\s\S]*?<\/div>\s*<\/div>/;
index = index.replace(contextPanelRegex, modalHtml);

fs.writeFileSync('src/index.html', index);
