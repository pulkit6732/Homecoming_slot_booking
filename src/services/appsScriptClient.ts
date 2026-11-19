/**
 * Client Service for Google Apps Script Web App Integration
 * 
 * Project: GITAM Interview Portal (Homecoming Slot Booking)
 * Communicates with the Google Apps Script Web App (VITE_APPS_SCRIPT_URL).
 * Provides seamless fallback to verified local storage ONLY during explicitly enabled development mode.
 * Zero emojis per specification.
 */

import type {
  ApiResponse,
  AvailabilityData,
  BookingConfirmationData,
  CancelBookingData,
  AdminScheduleData,
  AdminSummaryData,
  ReviewActionData,
  StudentDossierData,
  StudentListData
} from '../types/api.ts';
import { mockStorage } from './mockStorage.ts';
import { isDevMockAuthEnabled } from '../context/authEnv.ts';

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

  // text/plain avoids CORS preflight; Apps Script reads e.postData.contents regardless
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
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
 * Resolves student identity strictly on the backend via token in live mode.
 */
export async function createBooking(
  token: string,
  date: string,
  startTime: string,
  bookingRequestId: string,
  authenticatedStudentId?: string
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
    } catch (err: unknown) {
      if (!isDevMockAuthEnabled) {
        const msg = err instanceof Error ? err.message : 'Backend connection error';
        return {
          success: false,
          error: { code: 'BACKEND_ERROR', message: `Backend error: ${msg}` },
          timestamp: new Date().toISOString()
        };
      }
      // Fall through to dev mock if enabled
    }
  }

  if (!isDevMockAuthEnabled) {
    return {
      success: false,
      error: { code: 'BOOKING_DISABLED', message: 'Student slot booking is disabled in production while the registration database is being verified.' },
      timestamp: new Date().toISOString()
    };
  }

  if (!authenticatedStudentId) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authenticated student ID is required.' },
      timestamp: new Date().toISOString()
    };
  }

  const result = mockStorage.bookSlot({
    studentId: authenticatedStudentId,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  if (!targetStudentId) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Student ID is required to cancel a reservation.' },
      timestamp: new Date().toISOString()
    };
  }

  const result = mockStorage.cancelBooking(targetStudentId, 'Administrator');
  if (!result.success) {
    return {
      success: false,
      error: { code: 'CANCEL_FAILED', message: result.message },
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: true,
    data: {
      studentId: targetStudentId,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
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
 * Fetches all registered students from the Student Database (admin-only).
 */
export async function getAllStudents(token: string): Promise<ApiResponse<StudentListData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await getFromBackend<StudentListData>({ action: 'getStudentList', token });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const students = mockStorage.getAllStudents();
  return { success: true, data: { students, count: students.length }, timestamp: new Date().toISOString() };
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const actorEmail = adminEmail || 'Administrator';
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

/**
 * Fetches review details, private comments, and decision history for a student.
 */
export async function getReviewDetails(
  token: string,
  studentId: string
): Promise<ApiResponse<{
  studentId: string;
  approvalStatus: import('../types').ApprovalStatus;
  reviewFlagStatus: import('../types').ReviewFlagStatus;
  decisionBy: string;
  decisionTimestamp: string;
  decisionComment: string;
  rejectionReason: string;
  flaggedBy: string;
  flaggedAt: string;
  flagReason: string;
  comments: import('../types').AdminComment[];
  reviewHistory: import('../types').ReviewHistoryEntry[];
}>> {
  if (isLiveBackendConfigured()) {
    try {
      return await getFromBackend({
        action: 'getReviewDetails',
        token,
        studentId
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const details = mockStorage.getReviewDetails(studentId);
  if (!details) {
    return {
      success: false,
      error: { code: 'STUDENT_NOT_FOUND', message: `Student ${studentId} not found` },
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: true,
    data: details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Updates a student's approval status with decision reason and audit history.
 */
export async function changeApprovalStatus(
  token: string,
  studentId: string,
  newApprovalStatus: 'Approved' | 'Accepted' | 'Rejected' | 'Pending',
  reason?: string,
  adminEmail?: string
): Promise<ApiResponse<{
  studentId: string;
  approvalStatus: import('../types').ApprovalStatus;
  reviewFlagStatus: import('../types').ReviewFlagStatus;
  decisionBy: string;
  decisionTimestamp: string;
  decisionComment: string;
  reviewHistory: import('../types').ReviewHistoryEntry[];
}>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend({
        action: 'changeApprovalStatus',
        token,
        studentId,
        newApprovalStatus,
        reason
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const success = mockStorage.changeApprovalStatus(studentId, newApprovalStatus, reason, adminEmail);
  if (!success) {
    return {
      success: false,
      error: { code: 'UPDATE_FAILED', message: `Failed to update approval status for ${studentId}` },
      timestamp: new Date().toISOString()
    };
  }

  const details = mockStorage.getReviewDetails(studentId);
  return {
    success: true,
    data: {
      studentId,
      approvalStatus: details?.approvalStatus || newApprovalStatus,
      reviewFlagStatus: details?.reviewFlagStatus || 'Not Flagged',
      decisionBy: details?.decisionBy || adminEmail || 'Administrator',
      decisionTimestamp: details?.decisionTimestamp || new Date().toISOString(),
      decisionComment: reason || '',
      reviewHistory: details?.reviewHistory || []
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Updates a student's review flag with reason and audit history.
 */
export async function changeReviewFlag(
  token: string,
  studentId: string,
  newReviewFlagStatus: 'Yellow Flagged' | 'Flagged for Review' | 'Not Flagged',
  reason?: string,
  adminEmail?: string
): Promise<ApiResponse<{
  studentId: string;
  approvalStatus: import('../types').ApprovalStatus;
  reviewFlagStatus: import('../types').ReviewFlagStatus;
  flaggedBy: string;
  flaggedAt: string;
  flagReason: string;
  reviewHistory: import('../types').ReviewHistoryEntry[];
}>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend({
        action: 'changeReviewFlag',
        token,
        studentId,
        newReviewFlagStatus,
        reason
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const success = mockStorage.changeReviewFlag(studentId, newReviewFlagStatus, reason, adminEmail);
  if (!success) {
    return {
      success: false,
      error: { code: 'UPDATE_FAILED', message: `Failed to update review flag for ${studentId}` },
      timestamp: new Date().toISOString()
    };
  }

  const details = mockStorage.getReviewDetails(studentId);
  return {
    success: true,
    data: {
      studentId,
      approvalStatus: details?.approvalStatus || 'Pending',
      reviewFlagStatus: details?.reviewFlagStatus || newReviewFlagStatus,
      flaggedBy: details?.flaggedBy || '',
      flaggedAt: details?.flaggedAt || '',
      flagReason: details?.flagReason || '',
      reviewHistory: details?.reviewHistory || []
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Saves a private administrative comment for a student.
 */
export async function saveAdminComment(
  token: string,
  studentId: string,
  commentText: string,
  adminEmail?: string,
  adminUid?: string
): Promise<ApiResponse<{
  comment: import('../types').AdminComment;
  comments: import('../types').AdminComment[];
}>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend({
        action: 'createComment',
        token,
        studentId,
        commentText
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      return { success: false, error: { code: 'BACKEND_ERROR', message: msg }, timestamp: new Date().toISOString() };
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const res = mockStorage.createComment(studentId, commentText, adminEmail || 'admin@gitam.in', adminUid);
  if (!res.success || !res.comment) {
    return {
      success: false,
      error: { code: 'COMMENT_FAILED', message: res.error || 'Failed to save comment' },
      timestamp: new Date().toISOString()
    };
  }

  const allComments = mockStorage.getStudentById(studentId)?.adminComments || [res.comment];
  return {
    success: true,
    data: {
      comment: res.comment,
      comments: allComments
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Edits an administrator's existing comment. Preserves version history.
 */
export async function editAdminComment(
  token: string,
  studentId: string,
  commentId: string,
  newCommentText: string,
  adminEmail?: string
): Promise<ApiResponse<{
  updatedComment: import('../types').AdminComment;
  comments: import('../types').AdminComment[];
}>> {
  if (isLiveBackendConfigured()) {
    try {
      return await postToBackend({
        action: 'editComment',
        token,
        studentId,
        commentId,
        newCommentText
      });
    } catch {
      // Fall through
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const res = mockStorage.editComment(studentId, commentId, newCommentText, adminEmail || 'admin@gitam.in');
  if (!res.success || !res.comment) {
    return {
      success: false,
      error: { code: 'EDIT_FAILED', message: res.error || 'Failed to edit comment' },
      timestamp: new Date().toISOString()
    };
  }

  const allComments = mockStorage.getStudentById(studentId)?.adminComments || [res.comment];
  return {
    success: true,
    data: {
      updatedComment: res.comment,
      comments: allComments
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetches private comment history for a student. Strictly admin-only.
 */
export async function getCommentHistory(
  token: string,
  studentId: string
): Promise<ApiResponse<{
  studentId: string;
  comments: import('../types').AdminComment[];
}>> {
  if (isLiveBackendConfigured()) {
    try {
      return await getFromBackend({
        action: 'getCommentHistory',
        token,
        studentId
      });
    } catch {
      // Fall through
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  const comments = mockStorage.getStudentById(studentId)?.adminComments || [];
  return {
    success: true,
    data: {
      studentId,
      comments
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetches the student dossier using Registration Number as primary key.
 * Strictly admin-only. Never falls back to email or another student.
 */
export async function getStudentDossier(
  token: string,
  registrationNumber: string
): Promise<ApiResponse<StudentDossierData>> {
  if (isLiveBackendConfigured()) {
    try {
      return await getFromBackend<StudentDossierData>({
        action: 'getStudentDossier',
        token,
        registrationNumber
      });
    } catch {
      // Fall through to mockStorage in dev/mock mode
    }
  }

  if (!isDevMockAuthEnabled && !isLiveBackendConfigured()) {
    return {
      success: false,
      error: { code: 'BACKEND_NOT_CONFIGURED', message: 'Backend service is not configured.' },
      timestamp: new Date().toISOString()
    };
  }

  return mockStorage.getStudentDossier(registrationNumber);
}
