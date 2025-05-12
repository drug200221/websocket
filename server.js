const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
    cors: {
        // origin: "http://192.168.3.77:4200",
        origin: "http://localhost:4200",
    },
});
const { v4: uuidv4 } = require('uuid');

const sessionStore = new Map();

io.use((socket, next) => {
    const { sessionId, userId } = socket.handshake.auth;

    if (!userId) {
        return next(new Error("Invalid userId"));
    }

    let session;

    if (sessionId) {
        session = sessionStore.get(sessionId);
    }

    if (session) {
        socket.sessionId = sessionId;
        socket.userId = session.userId;
        sessionStore.set(sessionId, { ...session, connected: true });
    } else {
        const newSessionId = uuidv4();
        socket.sessionId = newSessionId;
        socket.userId = userId;
        sessionStore.set(newSessionId, { userId, connected: true });
        socket.emit('session', { sessionId: newSessionId, userId });
    }

    next();
});

io.on('connection', (socket) => {
    refreshUsers();

    socket.broadcast.emit("user connected", {
        userId: socket.userId,
        connected: true,
        messages: [],
    });

    socket.on('private message', ({message}) => {
        const targetSocket = getSocketByUserId(message.recipientId);
        console.log('targetSocket:', targetSocket.handshake.auth);
        if (targetSocket) {
            targetSocket.emit('private message', {
                from: socket.userId,
                message,
            });
        }
    });

    socket.on("disconnect", async () => {
        const sockets = await io.in(socket.userId).allSockets();
        if (sockets.size === 0) {
            const session = sessionStore.get(socket.sessionId);
            if (session) {
                sessionStore.set(socket.sessionId, { ...session, connected: false });
            }
            refreshUsers();
        }
    });
});

function getSocketByUserId(userId) {
    for (const socket of io.sockets.sockets.values()) {
        if (socket.handshake.auth.userId === userId.toString()) {
            return socket;
        }
    }
    return null;
}

function refreshUsers() {
    const sessions = Array.from(sessionStore.values());
    const users = sessions.map(({ userId, connected }) => ({ userId, connected }));
    io.emit('users', users);
}

// const hostname = "192.168.3.77";
const hostname = "localhost";
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, hostname, () =>
    console.log(`server listening at http://${hostname}:${PORT}`)
);