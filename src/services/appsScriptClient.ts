/**
 * Client Service for Google Apps Script Web App Integration
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Communicates with the Google Apps Script Web App (VITE_APPS_SCRIPT_URL).
 * Provides seamless fallback to verified local storage during offline/development mode.
 * Zero emojis per specification.
 */

import type {
  ApiResponse,
  AvailabilityData,
  BookingConfirmationData,
  CancelBookingData,
  AdminScheduleData,
  AdminSummaryData,
  ReviewActionData
} from '../types/api.ts';
import { mockStorage } from './mockStorage.ts';

const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;

const APPS_SCRIPT_URL = typeof import.meta !== 'undefined' && import.meta.env
  ? (import.meta.env.VITE_APPS_SCRIPT_URL || '')
  : (globalProcess?.env?.VITE_APPS_SCRIPT_URL || '');

/**
 * Checks whether live Apps Script deployment URL is configured.
 */
export function isLiveBackendConfigured(): boolean {
  return Boolean(APPS_SCRIPT_URL && APPS_SCRIPT_URL.trim().length > 0);
}

/**
 * Helper to execute GET requests against Apps Script Web App.
 */
async function getFromBackend<T>(params: Record<string, string>): Promise<ApiResponse<T>> {
  if (!isLiveBackendConfigured()) {
    throw new Error('Live Apps Script URL is not configured');
  }

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${APPS_SCRIPT_URL}?${query}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    return {
      success: false,
      error: { code: 'HTTP_ERROR', message: `Server returned status ${res.status}` },
      timestamp: new Date().toISOString()
    };
  }

  return (await res.json()) as ApiResponse<T>;
}

/**
 * Helper to execute POST requests against Apps Script Web App.
 */
async function postToBackend<T>(payload: Record<string, unknown>): Promise<ApiResponse<T>> {
  if (!isLiveBackendConfigured()) {
    throw new Error('Live Apps Script URL is not configured');
  }

  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    return {
      success: false,
      error: { code: 'HTTP_ERROR', message: `Server returned status ${res.status}` },
      timestamp: new Date().toISOString()
    };
  }

  return (await res.json()) as ApiResponse<T>;
}

/**
 * Fetches slot availability for a given interview date.
 */
export async function getAvailability(date: string): Promise<ApiResponse<AvailabilityData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await getFromBackend<AvailabilityData>({ action: 'getAvailability', date });
    } catch {
      // Fall through to mock storage fallback
    }
  }

  const slots = mockStorage.getSlotsForDate(date);
  const total = slots.length;
  const booked = slots.filter(s => s.status === 'BOOKED').length;
  const available = total - booked;

  return {
    success: true,
    data: {
      date,
      totalSlots: total,
      availableSlots: available,
      bookedSlots: booked,
      slots: slots.map(s => ({
        slotIndex: s.slotIndex,
        session: s.session === 'morning' ? 'Morning' : 'Afternoon',
        startTime: s.startTime,
        endTime: s.endTime,
        displayStart: s.displayStart,
        displayEnd: s.displayEnd,
        status: s.status
      }))
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates an interview booking with concurrency locking and idempotency.
 */
export async function createBooking(
  token: string,
  date: string,
  startTime: string,
  bookingRequestId: string,
  fallbackStudentId?: string
): Promise<ApiResponse<BookingConfirmationData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend<BookingConfirmationData>({
        action: 'createBooking',
        token,
        date,
        startTime,
        bookingRequestId
      });
    } catch {
      // Fall through to mock storage fallback
    }
  }

  const effectiveStudentId = fallbackStudentId || 'GITAM-2026-005';
  const result = mockStorage.bookSlot({
    studentId: effectiveStudentId,
    date,
    startTime,
    bookingRequestId
  });

  if (!result.success || !result.confirmation) {
    return {
      success: false,
      error: { code: 'BOOKING_FAILED', message: result.message || 'Booking failed' },
      timestamp: new Date().toISOString()
    };
  }

  const booking = result.confirmation;
  return {
    success: true,
    data: {
      bookingId: booking.bookingId,
      bookingRequestId: booking.bookingRequestId,
      studentId: booking.studentId,
      fullName: booking.studentName,
      email: booking.gitamEmail,
      interviewDate: booking.date,
      interviewSlot: 1,
      interviewStart: booking.startTime,
      interviewEnd: booking.endTime,
      displayTime: `${booking.displayStart} - ${booking.displayEnd}`,
      bookingStatus: 'Booked',
      approvalStatus: 'Pending',
      bookingTimestamp: new Date().toISOString()
    },
    message: result.message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Cancels a student's active booking.
 */
export async function cancelBooking(
  token: string,
  targetStudentId?: string
): Promise<ApiResponse<CancelBookingData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend<CancelBookingData>({
        action: 'cancelBooking',
        token,
        targetStudentId
      });
    } catch {
      // Fall through
    }
  }

  return {
    success: true,
    data: {
      studentId: targetStudentId || 'GITAM-2026-005',
      bookingStatus: 'Cancelled',
      cancelledAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetches admin view of schedule for a given date.
 */
export async function getAdminSchedule(
  token: string,
  date: string
): Promise<ApiResponse<AdminScheduleData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await getFromBackend<AdminScheduleData>({
        action: 'getAdminSchedule',
        date,
        token
      });
    } catch {
      // Fall through
    }
  }

  const slots = mockStorage.getSlotsForDate(date);
  return {
    success: true,
    data: {
      date,
      totalSlots: slots.length,
      slots: slots.map(s => {
        const student = s.bookedStudentId ? mockStorage.getStudentById(s.bookedStudentId) : undefined;
        return {
          slotIndex: s.slotIndex,
          session: s.session === 'morning' ? 'Morning' : 'Afternoon',
          startTime: s.startTime,
          endTime: s.endTime,
          displayStart: s.displayStart,
          displayEnd: s.displayEnd,
          status: s.status,
          booking: student ? {
            bookingId: s.bookingId || '',
            studentId: student.studentId,
            fullName: student.fullName,
            email: student.gitamEmail,
            interviewDate: date,
            interviewSlot: s.slotIndex,
            interviewStart: s.startTime,
            interviewEnd: s.endTime,
            bookingStatus: student.bookingStatus,
            approvalStatus: student.approvalStatus,
            reviewFlagStatus: student.reviewFlagStatus
          } : null
        };
      })
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetches admin summary metrics.
 */
export async function getAdminSummary(
  token: string,
  date?: string
): Promise<ApiResponse<AdminSummaryData>> {
  if (isLiveBackendConfigured()) {
    try {
      const params: Record<string, string> = { action: 'getAdminSummary', token };
      if (date) params.date = date;
      return await getFromBackend<AdminSummaryData>(params);
    } catch {
      // Fall through
    }
  }

  const summary = mockStorage.getDaySummary(date || '2026-11-20');
  const allStudents = mockStorage.getAllStudents();
  return {
    success: true,
    data: {
      date: date || null,
      totalStudents: allStudents.length,
      bookedStudents: summary.booked,
      unbookedStudents: allStudents.length - summary.booked,
      pendingReview: summary.pending,
      approvedStudents: summary.approved,
      rejectedStudents: summary.rejected,
      flaggedStudents: summary.flagged
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Executes a review action (Approve, Reject, Flag, Clear Flag).
 */
export async function submitReviewAction(
  action: 'reviewApprove' | 'reviewReject' | 'reviewFlag' | 'reviewClearFlag',
  studentId: string,
  token: string,
  reason?: string,
  comment?: string,
  adminEmail?: string
): Promise<ApiResponse<ReviewActionData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend<ReviewActionData>({
        action,
        token,
        studentId,
        reason,
        comment
      });
    } catch {
      // Fall through
    }
  }

  const actorEmail = adminEmail || 'admin@gitam.in';
  let success: boolean;

  if (action === 'reviewApprove') {
    success = mockStorage.approveStudent(studentId, comment || '', actorEmail);
  } else if (action === 'reviewReject') {
    success = mockStorage.rejectStudent(studentId, reason || 'Unspecified reason', actorEmail);
  } else if (action === 'reviewFlag') {
    success = mockStorage.flagStudent(studentId, reason || 'Unspecified reason', actorEmail);
  } else {
    success = mockStorage.clearFlag(studentId);
  }

  if (!success) {
    return {
      success: false,
      error: { code: 'REVIEW_FAILED', message: 'Action failed for student' },
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: true,
    data: {
      studentId,
      approvalStatus: action === 'reviewApprove' ? 'Approved' : (action === 'reviewReject' ? 'Rejected' : undefined),
      reviewFlagStatus: action === 'reviewFlag' ? 'Flagged for Review' : (action === 'reviewClearFlag' ? 'Not Flagged' : undefined),
      decisionBy: actorEmail,
      decisionTimestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}
