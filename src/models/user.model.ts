import { PrismaClient, User, Session } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export class UserModel {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id }
    });
  }

  async create(email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    return this.prisma.user.create({
      data: {
        id: uuidv4(),
        email,
        password: hashedPassword
      }
    });
  }

  async updateSsid(userId: string, ssid: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { ssid }
    });
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async createSession(userId: string, ssid: string, expiresAt: Date): Promise<Session> {
    return this.prisma.session.create({
      data: {
        id: uuidv4(),
        userId,
        ssid,
        expiresAt
      }
    });
  }

  async findActiveSession(ssid: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        ssid,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });
  }

  async deactivateSession(ssid: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { ssid },
      data: { isActive: false }
    });
  }
}