const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    // Bağlantı Logu
    // console.log('Yeni Socket Bağlantısı:', socket.id); 

    socket.on('join_room', ({ roomId, nick }) => {
        socket.join(roomId);
        socket.nickname = nick; 
        
        // LOG: Katılma
        console.log(`[KATILDI] ${nick} (${socket.id}) -> Oda: ${roomId}`);

        const clients = io.sockets.adapter.rooms.get(roomId);
        const otherUsers = [];
        
        if (clients) {
            clients.forEach(clientId => {
                if (clientId !== socket.id) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    otherUsers.push({ 
                        id: clientId, 
                        nick: clientSocket ? clientSocket.nickname : "Bilinmiyor" 
                    });
                }
            });
        }

        socket.emit('all_users', otherUsers);
        socket.to(roomId).emit('user_joined', { id: socket.id, nick: nick });
    });

    // --- YENİ EKLENEN: MİKROFON LOGU ---
    socket.on('mic_status', ({ roomId, isMuted }) => {
        const status = isMuted ? "KAPATTI (MUTE)" : "AÇTI (UNMUTE)";
        console.log(`[MİKROFON] ${socket.nickname || 'Bilinmiyor'} -> ${status}`);
        
        // İsterseniz odadaki diğer kişilere de bildirebilirsiniz (ikon değişimi için)
        // socket.to(roomId).emit('user_mic_change', { id: socket.id, isMuted: isMuted });
    });

    // --- YENİ EKLENEN: AYRILMA LOGU (Manuel Çıkış) ---
    socket.on('leave_room', ({ roomId }) => {
        console.log(`[AYRILDI] ${socket.nickname || 'Bilinmiyor'} -> Oda: ${roomId}`);
        socket.leave(roomId);
        socket.to(roomId).emit('user_left', { id: socket.id });
    });

    // WebRTC Sinyalleri
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { sdp: data.sdp, responder: socket.id });
    });

    socket.on('ice_candidate', (data) => {
        io.to(data.target).emit('ice_candidate', { candidate: data.candidate, sender: socket.id });
    });

    // Bağlantı Kopması (Otomatik Çıkış)
    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                console.log(`[KOPTU] ${socket.nickname || 'Bilinmiyor'} -> Oda: ${room}`);
                socket.to(room).emit('user_left', { id: socket.id });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Game Voice Server running on port ${PORT}`);
});
