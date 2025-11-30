import { io, Socket } from 'socket.io-client'

/**
 * WebSocket connection manager for real-time updates.
 * Manages Socket.IO connection lifecycle.
 */
class SocketManager {
    private socket: Socket | null = null
    private readonly serverUrl = 'http://localhost:4000'

    /**
     * Connect to WebSocket server
     */
    connect(): Socket {
        if (!this.socket || !this.socket.connected) {
            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling']
            })

            this.socket.on('connect', () => {
                console.log('[WebSocket] Connected:', this.socket?.id)
            })

            this.socket.on('disconnect', (reason) => {
                console.log('[WebSocket] Disconnected:', reason)
            })

            this.socket.on('connect_error', (error) => {
                console.error('[WebSocket] Connection error:', error)
            })
        }

        return this.socket
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
            console.log('[WebSocket] Disconnected manually')
        }
    }

    /**
     * Get current socket instance (creates connection if needed)
     */
    getSocket(): Socket {
        return this.socket && this.socket.connected ? this.socket : this.connect()
    }

    /**
     * Check if currently connected
     */
    isConnected(): boolean {
        return this.socket?.connected || false
    }
}

// Singleton instance
export const socketManager = new SocketManager()
