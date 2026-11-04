export function createLearnSyncView(viewContext) {
    function resetPrompt() {
        document.getElementById('learn-reset-dialog')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'learn-reset-dialog';
        dialog.className = 'learn-dialog learn-reset-dialog';
        dialog.innerHTML = '<h2>Reset learning progress?</h2><p>This clears this profile’s practice history' + (viewContext.store.enabled ? ' on this device and your synced account' : ' on this device') + '. Your quizzes stay as they are.</p><div class="learn-dialog-actions"><button class="btn ghost" data-cancel>Keep progress</button><button class="btn danger" data-confirm>Reset progress</button></div>';
        document.body.append(dialog);
        dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
        dialog.querySelector('[data-confirm]').onclick = async () => { const button = dialog.querySelector('[data-confirm]'); button.disabled = true; const cleared = await viewContext.store.reset(); if (cleared !== true) {
            button.disabled = false;
            return;
        } dialog.close(); viewContext.mode = 'cards'; viewContext.topicView(); viewContext.notify?.('Learning progress reset.'); };
        dialog.addEventListener('close', () => { viewContext.disposeMaps(dialog); dialog.remove(); }, { once: true });
        dialog.showModal();
        viewContext.mountMaps(dialog);
    }
    function syncPrompt() {
        document.getElementById('learn-sync-dialog')?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = 'learn-sync-dialog';
        dialog.className = 'learn-dialog learn-reset-dialog';
        dialog.innerHTML = '<h2>Save to your account?</h2><p>Sync your learning progress across devices, including guest practice saved here. You can pause sync at any time.</p><div class="learn-dialog-actions"><button class="btn ghost" data-cancel>Not now</button><button class="btn primary" data-confirm>Enable sync</button></div>';
        document.body.append(dialog);
        dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
        dialog.querySelector('[data-confirm]').onclick = async () => { dialog.close(); await viewContext.store.enable(); };
        dialog.addEventListener('close', () => { viewContext.disposeMaps(dialog); dialog.remove(); }, { once: true });
        dialog.showModal();
        viewContext.mountMaps(dialog);
    }
    return { resetPrompt, syncPrompt };
}
