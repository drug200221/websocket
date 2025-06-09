const httpServer = require("http").createServer();

const hostname = "192.168.3.77";
// const hostname = "localhost";
const PORT = process.env.PORT || 3000;
const clientPort = 4200;

const io = require("socket.io")(httpServer, {
    cors: {
        origin: `http://${hostname}:${clientPort}`,
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
    });
    console.log(sessionStore.values())

    socket.on('message', ({recipientId, message }) => {
        const targetSocket = getSocketByUserId(recipientId);
        if (targetSocket) {
            targetSocket.emit('message', {
                from: socket.userId,
                recipientId,
                message,
            });
        }
    });

    socket.on('read messages', ({message}) => {
        const targetSocket = getSocketByUserId(message.sender.id);
        if (targetSocket) {
            targetSocket.emit('read messages', {
                from: socket.userId,
                message,
            });
        }
    });

    socket.on('create chat', ({chat}) => {
        const targetSocket = getSocketByUserId(chat.userId);
        if (targetSocket) {
            targetSocket.emit('create chat', {
                from: chat.userId,
                chat
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

httpServer.listen(PORT, hostname, () =>
    console.log(`server listening at http://${hostname}:${PORT}`)
);