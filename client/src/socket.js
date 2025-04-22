import { io } from "socket.io-client";

// connect to backend server
const socket = io("http://localhost:4000", {
    autoConnect: false,
});

export default socket;
