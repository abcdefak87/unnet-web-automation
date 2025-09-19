import { z } from 'zod'

// Common validation schemas
export const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Format nomor telepon tidak valid')
  .min(10, 'Nomor telepon harus minimal 10 digit')
  .max(15, 'Nomor telepon tidak boleh lebih dari 15 digit')

export const emailSchema = z.string()
  .email('Format email tidak valid')
  .min(5, 'Email harus minimal 5 karakter')
  .max(100, 'Email tidak boleh lebih dari 100 karakter')

export const ktpSchema = z.string()
  .length(16, 'Nomor KTP harus tepat 16 digit')
  .regex(/^\d{16}$/, 'Nomor KTP hanya boleh berisi angka')

export const passwordSchema = z.string()
  .min(8, 'Password harus minimal 8 karakter')
  .max(100, 'Password tidak boleh lebih dari 100 karakter')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password harus mengandung minimal satu huruf kecil, satu huruf besar, dan satu angka')

// User validation schemas
export const userRegistrationSchema = z.object({
  name: z.string()
    .min(2, 'Nama harus minimal 2 karakter')
    .max(100, 'Nama tidak boleh lebih dari 100 karakter')
    .regex(/^[a-zA-Z\s]+$/, 'Nama hanya boleh berisi huruf dan spasi'),
  
  username: z.string()
    .min(3, 'Username harus minimal 3 karakter')
    .max(50, 'Username tidak boleh lebih dari 50 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh berisi huruf, angka, dan underscore'),
  
  email: emailSchema,
  
  password: passwordSchema,
  
  confirmPassword: z.string(),
  
  role: z.enum(['admin', 'user', 'technician', 'gudang']),
  
  whatsappNumber: phoneSchema.optional(),
  
  isActive: z.boolean().default(true)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password tidak cocok",
  path: ["confirmPassword"]
})

export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password diperlukan')
})

export const userUpdateSchema = z.object({
  name: z.string()
    .min(2, 'Nama harus minimal 2 karakter')
    .max(100, 'Nama tidak boleh lebih dari 100 karakter')
    .regex(/^[a-zA-Z\s]+$/, 'Nama hanya boleh berisi huruf dan spasi')
    .optional(),
  
  email: emailSchema.optional(),
  
  whatsappNumber: phoneSchema.optional(),
  
  role: z.enum(['admin', 'user', 'technician', 'gudang']).optional(),
  
  isActive: z.boolean().optional()
})

// Customer validation schemas
export const customerSchema = z.object({
  name: z.string()
    .min(2, 'Nama harus minimal 2 karakter')
    .max(100, 'Nama tidak boleh lebih dari 100 karakter')
    .regex(/^[a-zA-Z\s]+$/, 'Nama hanya boleh berisi huruf dan spasi'),
  
  email: emailSchema.optional(),
  
  phone: phoneSchema,
  
  address: z.string()
    .min(10, 'Alamat harus minimal 10 karakter')
    .max(500, 'Alamat tidak boleh lebih dari 500 karakter'),
  
  ktpNumber: ktpSchema,
  
  ktpImage: z.string().optional(),
  
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).optional(),
  
  notes: z.string().max(1000, 'Catatan tidak boleh lebih dari 1000 karakter').optional()
})

export const customerUpdateSchema = customerSchema.partial()

// Job validation schemas
export const jobSchema = z.object({
  type: z.enum(['installation', 'repair', 'PSB', 'GANGGUAN']),
  
  category: z.enum(['PSB', 'GANGGUAN']),
  
  title: z.string()
    .min(5, 'Judul harus minimal 5 karakter')
    .max(200, 'Judul tidak boleh lebih dari 200 karakter'),
  
  description: z.string()
    .min(10, 'Deskripsi harus minimal 10 karakter')
    .max(1000, 'Deskripsi tidak boleh lebih dari 1000 karakter')
    .optional(),
  
  problemType: z.string()
    .min(3, 'Tipe masalah harus minimal 3 karakter')
    .max(100, 'Tipe masalah tidak boleh lebih dari 100 karakter')
    .optional(),
  
  address: z.string()
    .min(10, 'Alamat harus minimal 10 karakter')
    .max(500, 'Alamat tidak boleh lebih dari 500 karakter'),
  
  customerId: z.string().min(1, 'ID Pelanggan diperlukan'),
  
  scheduledDate: z.string().datetime().optional(),
  
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  
  estimatedDuration: z.number().min(1).max(480).optional(), // 1 minute to 8 hours
  
  items: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().min(1).max(100)
  })).optional()
})

export const jobUpdateSchema = jobSchema.partial()

// Technician validation schemas
export const technicianSchema = z.object({
  name: z.string()
    .min(2, 'Nama harus minimal 2 karakter')
    .max(100, 'Nama tidak boleh lebih dari 100 karakter'),
  
  email: emailSchema,
  
  phone: phoneSchema,
  
  address: z.string()
    .min(10, 'Alamat harus minimal 10 karakter')
    .max(500, 'Alamat tidak boleh lebih dari 500 karakter'),
  
  skills: z.array(z.string()).optional(),
  
  experience: z.number().min(0).max(50).optional(),
  
  isActive: z.boolean().default(true),
  
  notes: z.string().max(1000, 'Catatan tidak boleh lebih dari 1000 karakter').optional()
})

export const technicianUpdateSchema = technicianSchema.partial()

// Inventory validation schemas
export const itemSchema = z.object({
  name: z.string()
    .min(2, 'Nama harus minimal 2 karakter')
    .max(100, 'Nama tidak boleh lebih dari 100 karakter'),
  
  code: z.string()
    .min(2, 'Kode harus minimal 2 karakter')
    .max(50, 'Kode tidak boleh lebih dari 50 karakter')
    .regex(/^[A-Z0-9_-]+$/, 'Kode hanya boleh berisi huruf besar, angka, tanda hubung, dan underscore'),
  
  category: z.enum(['TEKNISI', 'KEPERLUAN_BERSAMA', 'MODEM']),
  
  subcategory: z.string().max(50).optional(),
  
  description: z.string().max(500).optional(),
  
  unit: z.string().max(20).default('pcs'),
  
  currentStock: z.number().min(0).default(0),
  
  minStock: z.number().min(0).default(0),
  
  price: z.number().min(0).default(0),
  
  location: z.string().max(100).optional(),
  
  isActive: z.boolean().default(true),
  
  isBatch: z.boolean().default(false),
  
  batchType: z.enum(['MIXED_MODEM', 'SINGLE_TYPE']).optional(),
  
  serialNumbers: z.array(z.string()).optional()
})

export const itemUpdateSchema = itemSchema.partial()

// Search and filter schemas
export const searchSchema = z.object({
  query: z.string().max(100).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export const jobFilterSchema = searchSchema.extend({
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  type: z.enum(['installation', 'repair', 'PSB', 'GANGGUAN']).optional(),
  category: z.enum(['PSB', 'GANGGUAN']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  technicianId: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
})

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: 'File diperlukan' }),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB default
  allowedTypes: z.array(z.string()).default(['image/jpeg', 'image/png', 'image/webp'])
}).refine((data) => data.file.size <= data.maxSize, {
  message: 'Ukuran file melebihi batas maksimum yang diizinkan',
  path: ['file']
}).refine((data) => data.allowedTypes.includes(data.file.type), {
  message: 'Tipe file tidak diizinkan',
  path: ['file']
})

// WhatsApp validation schemas
export const whatsappMessageSchema = z.object({
  to: phoneSchema,
  message: z.string()
    .min(1, 'Pesan tidak boleh kosong')
    .max(1000, 'Pesan tidak boleh lebih dari 1000 karakter'),
  type: z.enum(['text', 'image', 'document']).default('text')
})

export const whatsappBroadcastSchema = z.object({
  type: z.enum(['technicians', 'customers', 'all']),
  message: z.string()
    .min(1, 'Pesan tidak boleh kosong')
    .max(1000, 'Pesan tidak boleh lebih dari 1000 karakter'),
  title: z.string().max(100).optional()
})

// Utility functions
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
      throw new Error(`Validasi gagal: ${JSON.stringify(formattedErrors)}`)
    }
    throw error
  }
}

export const validateDataSafe = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } => {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
      return { success: false, errors }
    }
    return { success: false, errors: ['Error validasi tidak diketahui'] }
  }
}

// Type exports for TypeScript
export type UserRegistrationData = z.infer<typeof userRegistrationSchema>
export type UserLoginData = z.infer<typeof userLoginSchema>
export type UserUpdateData = z.infer<typeof userUpdateSchema>
export type CustomerData = z.infer<typeof customerSchema>
export type CustomerUpdateData = z.infer<typeof customerUpdateSchema>
export type JobData = z.infer<typeof jobSchema>
export type JobUpdateData = z.infer<typeof jobUpdateSchema>
export type TechnicianData = z.infer<typeof technicianSchema>
export type TechnicianUpdateData = z.infer<typeof technicianUpdateSchema>
export type ItemData = z.infer<typeof itemSchema>
export type ItemUpdateData = z.infer<typeof itemUpdateSchema>
export type SearchData = z.infer<typeof searchSchema>
export type JobFilterData = z.infer<typeof jobFilterSchema>
export type FileUploadData = z.infer<typeof fileUploadSchema>
export type WhatsAppMessageData = z.infer<typeof whatsappMessageSchema>
export type WhatsAppBroadcastData = z.infer<typeof whatsappBroadcastSchema>
