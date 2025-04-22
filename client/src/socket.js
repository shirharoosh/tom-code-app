import { io } from "socket.io-client";

// connect to backend server
const socket = io(import.meta.env.VITE_BACKEND_URL, {
    autoConnect: false,
});

export default socket;
