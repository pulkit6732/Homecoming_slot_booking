/**
 * API Contracts and TypeScript Interfaces matching Google Apps Script Backend
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Conforming to PHASE 4 API specifications.
 * Zero emojis per specification.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface SlotAvailability {
  slotIndex: number;
  session: 'Morning' | 'Afternoon';
  startTime: string; // HH:mm (24h)
  endTime: string;   // HH:mm (24h)
  displayStart: string; // e.g. "09:00 AM"
  displayEnd: string;   // e.g. "09:10 AM"
  status: 'AVAILABLE' | 'BOOKED';
}

export interface AvailabilityData {
  date: string;
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  slots: SlotAvailability[];
}

export interface CreateBookingPayload {
  action: 'createBooking';
  token: string;
  date: string;
  startTime: string;
  bookingRequestId: string;
}

export interface BookingConfirmationData {
  bookingId: string;
  bookingRequestId: string;
  studentId: string;
  fullName: string;
  email: string;
  interviewDate: string;
  interviewSlot: number;
  interviewStart: string;
  interviewEnd: string;
  displayTime: string;
  bookingStatus: 'Booked';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  bookingTimestamp: string;
  isIdempotentReplay?: boolean;
}

export interface CancelBookingPayload {
  action: 'cancelBooking';
  token: string;
  targetStudentId?: string;
}

export interface CancelBookingData {
  studentId: string;
  bookingStatus: 'Cancelled';
  cancelledAt: string;
}

export interface AdminScheduleSlot {
  slotIndex: number;
  session: 'Morning' | 'Afternoon';
  startTime: string;
  endTime: string;
  displayStart: string;
  displayEnd: string;
  status: 'AVAILABLE' | 'BOOKED';
  booking: {
    bookingId: string;
    studentId: string;
    fullName: string;
    email: string;
    interviewDate: string;
    interviewSlot: number;
    interviewStart: string;
    interviewEnd: string;
    bookingStatus: string;
    approvalStatus: string;
    reviewFlagStatus: string;
  } | null;
}

export interface AdminScheduleData {
  date: string;
  totalSlots: number;
  slots: AdminScheduleSlot[];
}

export interface AdminSummaryData {
  date: string | null;
  totalStudents: number;
  bookedStudents: number;
  unbookedStudents: number;
  pendingReview: number;
  approvedStudents: number;
  rejectedStudents: number;
  flaggedStudents: number;
}

export interface ReviewActionPayload {
  action: 'reviewApprove' | 'reviewReject' | 'reviewFlag' | 'reviewClearFlag';
  token: string;
  studentId: string;
  reason?: string;
  comment?: string;
}

export interface ReviewActionData {
  studentId: string;
  approvalStatus?: 'Approved' | 'Rejected' | undefined;
  reviewFlagStatus?: 'Flagged for Review' | 'Not Flagged' | undefined;
  decisionBy?: string | undefined;
  decisionTimestamp?: string | undefined;
  rejectionReason?: string | undefined;
  flaggedBy?: string | undefined;
  flaggedAt?: string | undefined;
  flagReason?: string | undefined;
  flagClearedBy?: string | undefined;
  flagClearedAt?: string | undefined;
}

export type StudentDossierData = import('./index').StudentDossier;

export interface GetDossierPayload {
  action: 'getStudentDossier';
  token: string;
  registrationNumber: string;
}
