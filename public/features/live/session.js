export function createFeaturesLiveSession(context) {
    const S = context.state;
    function roomLink(code) { return `${location.origin}${location.pathname}#join/${code}`; }
    function normalizePlayerName(name) { return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US'); }
    function playerRoomKey(code) { return `gather.player.${code}`; }
    function playerNameKey(code, name) { return `${playerRoomKey(code)}.${encodeURIComponent(JSON.stringify(normalizePlayerName(name)))}`; }
    function savedPlayer(code, name) {
        for (const [storage, key] of [[localStorage, playerNameKey(code, name)], [localStorage, playerRoomKey(code)], [sessionStorage, playerRoomKey(code)]])
            try {
                const player = JSON.parse(storage.getItem(key) || 'null');
                if (player?.name && normalizePlayerName(player.name) === normalizePlayerName(name))
                    return player;
            }
            catch { }
        return null;
    }
    function forgetPlayer(room, clearAnswers = false) {
        const matches = player => player && ((room.playerId && player.playerId === room.playerId) || (room.resumeToken && player.resumeToken === room.resumeToken));
        for (const storage of [localStorage, sessionStorage])
            try {
                for (const key of [playerNameKey(room.code, room.name), playerRoomKey(room.code)])
                    if (matches(JSON.parse(storage.getItem(key) || 'null')))
                        storage.removeItem(key);
            }
            catch { }
        if (clearAnswers)
            try {
                for (let i = sessionStorage.length - 1; i >= 0; i--)
                    if (sessionStorage.key(i)?.startsWith(`gather.answer.${room.code}.`))
                        sessionStorage.removeItem(sessionStorage.key(i));
            }
            catch { }
    }
    return { roomLink, normalizePlayerName, playerRoomKey, playerNameKey, savedPlayer, forgetPlayer };
}
