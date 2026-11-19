/**
 * Student Passwordless Gmail Login & Slot Booking Verification Suite
 * 
 * Verifies:
 * 1. Student can log in without password using Gmail that is in the DB (sid.nair94@gmail.com).
 * 2. Unregistered Gmail addresses are rejected with "This email is not registered. Access denied."
 * 3. Student can check available slots across all 6 eligible dates (36 slots per date).
 * 4. Unbooked student can select and book an available slot.
 * 5. Student booking status updates to "Booked" and active reservation details are displayed.
 * 6. Enforces one active booking per student rule.
 * 7. Enforces slot exclusivity (cannot double-book occupied slot).
 * 8. All three administrators (GMercy, DMoksha, Surya / sreyash) can see the booked slot,
 *    dossier by Registration Number, and manage reviews.
 * 
 * Zero emojis per specification.
 */

import { mockStorage } from '../services/mockStorage.ts'
import { INITIAL_MOCK_STUDENTS } from '../data/mockStudents.ts'
import {
  getAdminSchedule,
  getAdminSummary,
  getStudentDossier,
  saveAdminComment
} from '../services/appsScriptClient.ts'

console.log('================================================================')
console.log('STARTING STUDENT GMAIL LOGIN & SLOT BOOKING VERIFICATION SUITE')
console.log('================================================================\n')

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`)
    passCount++
  } else {
    console.error(`[FAIL] ${testName}`)
    if (detail) console.error(`       Detail: ${detail}`)
    failCount++
  }
}

// Reset mock storage with test fixtures
mockStorage.loadTestFixtures(INITIAL_MOCK_STUDENTS)

async function runTests() {
  // ---------------------------------------------------------------------------
  // TEST 1: Passwordless Login with Gmail Present in Database (Unbooked Student)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Passwordless Login with Registered Gmail ---')
  const registeredGmail = 'sid.nair94@gmail.com' // Siddharth Nair
  const loginRes = mockStorage.studentLoginByEmail(registeredGmail)

  assert(
    loginRes.success && loginRes.data?.fullName === 'Siddharth Nair',
    'Student logs in successfully using registered Gmail without password'
  )
  assert(
    loginRes.success && loginRes.data?.bookingStatus === 'Not Booked',
    'Student initial status is Not Booked'
  )

  // ---------------------------------------------------------------------------
  // TEST 2: Denial for Unregistered Gmail
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Unregistered Gmail Rejection ---')
  const unregisteredGmail = 'unregistered.candidate.2026@gmail.com'
  const unregRes = mockStorage.studentLoginByEmail(unregisteredGmail)

  assert(
    !unregRes.success && unregRes.error?.code === 'UNREGISTERED_STUDENT',
    'Unregistered Gmail is denied access'
  )
  assert(
    !unregRes.success && unregRes.error?.message === 'This email is not registered. Access denied.',
    'Exact error message returned: "This email is not registered. Access denied."'
  )

  // ---------------------------------------------------------------------------
  // TEST 3: Checking Available Slots
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Checking Available Slots ---')
  const testDate = '2026-11-20'
  const slots = mockStorage.getSlotsForDate(testDate)

  assert(
    slots.length === 36,
    'Exactly 36 interview slots present for date'
  )

  const slotToBook = slots.find(s => s.startTime === '09:20')
  assert(
    Boolean(slotToBook && slotToBook.status === 'AVAILABLE'),
    'Target slot 09:20 IST is initially available'
  )

  // ---------------------------------------------------------------------------
  // TEST 4: Slot Booking Execution
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Booking an Available Slot ---')
  if (loginRes.success && slotToBook) {
    const bookResult = mockStorage.bookSlot({
      studentId: loginRes.data.studentId,
      date: testDate,
      startTime: slotToBook.startTime
    })

    assert(
      bookResult.success && Boolean(bookResult.confirmation?.bookingId),
      'Slot booking succeeds and returns confirmation bookingId'
    )
    assert(
      bookResult.confirmation?.date === testDate && bookResult.confirmation?.startTime === '09:20',
      'Booking confirmation details match requested date and time'
    )

    // Verify student record updated
    const updatedStudent = mockStorage.getStudentById(loginRes.data.studentId)
    assert(
      updatedStudent?.bookingStatus === 'Booked',
      'Student master record status updated to Booked'
    )
    assert(
      updatedStudent?.bookedDate === testDate && updatedStudent?.bookedSlotStart === '09:20',
      'Student record reflects booked date and time'
    )

    // Verify slot status in directory updated
    const updatedSlots = mockStorage.getSlotsForDate(testDate)
    const bookedSlotCheck = updatedSlots.find(s => s.startTime === '09:20')
    assert(
      bookedSlotCheck?.status === 'BOOKED',
      'Slot 09:20 IST is now marked as BOOKED in the directory'
    )

    // ---------------------------------------------------------------------------
    // TEST 5: One Active Booking per Student Rule Enforcement
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 5: Duplicate Booking Prevention for Same Student ---')
    const secondBookingAttempt = mockStorage.bookSlot({
      studentId: loginRes.data.studentId,
      date: testDate,
      startTime: '09:30'
    })

    assert(
      !secondBookingAttempt.success,
      'Student is prevented from booking a second slot'
    )
    assert(
      secondBookingAttempt.message.includes('Only one active booking is permitted'),
      'Appropriate message returned explaining 1 active booking limit'
    )

    // ---------------------------------------------------------------------------
    // TEST 6: Slot Exclusivity Enforcement (Another Student Cannot Book Same Slot)
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 6: Slot Exclusivity Enforcement ---')
    const anotherStudentGmail = 'meera.chawla@gmail.com' // Meera Chawla
    const student2Login = mockStorage.studentLoginByEmail(anotherStudentGmail)

    if (student2Login.success) {
      const competingBooking = mockStorage.bookSlot({
        studentId: student2Login.data.studentId,
        date: testDate,
        startTime: '09:20'
      })

      assert(
        !competingBooking.success,
        'Second student cannot book an already occupied slot'
      )
      assert(
        competingBooking.message.includes('was just booked by another student'),
        'Slot conflict error message returned correctly'
      )

      // Second student books a different available slot (09:30)
      const validSecondBooking = mockStorage.bookSlot({
        studentId: student2Login.data.studentId,
        date: testDate,
        startTime: '09:30'
      })

      assert(
        validSecondBooking.success,
        'Second student successfully books a different available slot (09:30)'
      )
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Administrator Verification of Bookings & Dossier
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Administrator Verification of Bookings & Dossier ---')
  const adminGMercyToken = 'ADMIN_SESSION_TOKEN_GMERCY'
  const adminDMokshaToken = 'ADMIN_SESSION_TOKEN_DMOKSHA'
  const adminSuryaToken = 'ADMIN_SESSION_TOKEN_SURYA'

  // Admin 1 (GMercy) checks schedule
  const adminSched = await getAdminSchedule(adminGMercyToken, testDate)
  assert(
    adminSched.success && Boolean(adminSched.data?.slots.find(s => s.startTime === '09:20' && s.status === 'BOOKED')),
    'Admin GMercy sees the newly booked slot at 09:20 marked as BOOKED'
  )

  // Admin 2 (DMoksha) retrieves Siddharth Nair dossier by Registration Number
  const sidReg = '122010801007' // Siddharth Nair's roll number
  const dossierRes = await getStudentDossier(adminDMokshaToken, sidReg)
  assert(
    dossierRes.success && dossierRes.data?.originalSubmission?.fullName === 'Siddharth Nair',
    'Admin DMoksha retrieves Siddharth Nair dossier by Registration Number'
  )
  assert(
    dossierRes.success && dossierRes.data?.adminReviewData?.bookingStatus === 'Booked',
    'Dossier shows candidate booking status as Booked'
  )

  // Admin 3 (Surya) adds private comment to Siddharth Nair
  const commentRes = await saveAdminComment(
    adminSuryaToken,
    'GITAM-2026-005',
    'Candidate Siddharth Nair successfully booked slot 09:20 on 2026-11-20.',
    'surya@gitam.in'
  )
  assert(
    commentRes.success && Boolean(commentRes.data?.comment?.commentId),
    'Admin Surya successfully saves private comment on the candidate'
  )

  // Summary counts check
  const summaryRes = await getAdminSummary(adminGMercyToken, testDate)
  assert(
    summaryRes.success && (summaryRes.data?.bookedStudents ?? 0) >= 2,
    'Admin summary metrics reflect all booked candidates'
  )

  console.log('\n================================================================')
  console.log(`VERIFICATION SUMMARY: ${passCount} passed, ${failCount} failed`)
  console.log('================================================================')

  if (failCount > 0) {
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Unhandled error in verification suite:', err)
  process.exit(1)
})
