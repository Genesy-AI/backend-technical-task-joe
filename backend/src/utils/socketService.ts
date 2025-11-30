import { Server as SocketIOServer } from 'socket.io'

class SocketService {
    private static instance: SocketService
    private io: SocketIOServer | null = null

    private constructor() { }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService()
        }
        return SocketService.instance
    }

    public setIO(io: SocketIOServer) {
        this.io = io
    }

    public getIO(): SocketIOServer | null {
        return this.io
    }

    public emit(roomId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(roomId).emit(event, data)
        } else {
            console.warn('[SocketService] IO not initialized, cannot emit event:', event)
        }
    }
}

export const socketService = SocketService.getInstance()
