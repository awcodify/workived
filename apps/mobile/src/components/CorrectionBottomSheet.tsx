import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  TextInput, ActivityIndicator, Pressable, Platform, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '@/api/client'

interface Props {
  visible: boolean
  onClose: () => void
  initialDate?: string // YYYY-MM-DD format
}

function toLocalTimeString(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function combineDateAndTime(date: Date, time: Date): string {
  const d = new Date(date)
  d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return d.toISOString()
}

export function CorrectionBottomSheet({ visible, onClose, initialDate }: Props) {
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const today = new Date()
  const slideAnim = useRef(new Animated.Value(600)).current
  const [isModalVisible, setIsModalVisible] = useState(false)

  // Parse initial date or default to yesterday
  const getInitialDate = () => {
    if (initialDate) {
      const [year, month, day] = initialDate.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  }

  useEffect(() => {
    if (visible) {
      setIsModalVisible(true)
      slideAnim.setValue(600)
      setTimeout(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start()
      }, 50)
    }
  }, [visible, slideAnim])

  const [date, setDate] = useState(getInitialDate())

  // Update date when initialDate changes
  useEffect(() => {
    if (visible && initialDate) {
      const [year, month, day] = initialDate.split('-').map(Number)
      setDate(new Date(year, month - 1, day))
    }
  }, [initialDate, visible])
  const [clockIn, setClockIn] = useState<Date | null>(null)
  const [clockOut, setClockOut] = useState<Date | null>(null)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Picker visibility state
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showClockInPicker, setShowClockInPicker] = useState(false)
  const [showClockOutPicker, setShowClockOutPicker] = useState(false)

  const [errors, setErrors] = useState<{ time?: string; reason?: string }>({})

  const mutation = useMutation({
    mutationFn: () => apiClient.submitCorrection({
      date: toDateString(date),
      requested_clock_in: clockIn ? combineDateAndTime(date, clockIn) : undefined,
      requested_clock_out: clockOut ? combineDateAndTime(date, clockOut) : undefined,
      reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corrections', 'mine'] })
      setSubmitted(true)
    },
  })

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!clockIn && !clockOut) e.time = 'Enter at least one time (clock-in or clock-out)'
    if (reason.trim().length < 10) e.reason = 'Reason must be at least 10 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (validate()) mutation.mutate()
  }

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsModalVisible(false)
      setDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
      setClockIn(null)
      setClockOut(null)
      setReason('')
      setErrors({})
      setSubmitted(false)
      onClose()
    })
  }

  return (
    <Modal visible={isModalVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>Request Correction</Text>
              <TouchableOpacity onPress={handleClose} testID="correction-close-btn">
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.successBlock} testID="correction-success">
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text style={styles.successTitle}>Correction Requested</Text>
                <Text style={styles.successSub}>Pending manager approval</Text>
                <TouchableOpacity style={styles.doneBtn} onPress={handleClose} testID="correction-done-btn">
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 16 }} showsVerticalScrollIndicator={false}>
                {/* Date */}
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowDatePicker(true)}
                  testID="correction-date-btn"
                >
                  <Ionicons name="calendar-outline" size={18} color="#6357E8" />
                  <Text style={styles.pickerBtnText}>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Clock-in */}
                <Text style={styles.label}>
                  Requested Clock-in <Text style={styles.optional}>(optional)</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, clockIn && styles.pickerBtnActive]}
                  onPress={() => setShowClockInPicker(true)}
                  testID="correction-clockin-btn"
                >
                  <Ionicons name="time-outline" size={18} color={clockIn ? '#6357E8' : '#9CA3AF'} />
                  <Text style={[styles.pickerBtnText, !clockIn && styles.pickerBtnPlaceholder]}>
                    {clockIn ? toLocalTimeString(clockIn) : 'Select time'}
                  </Text>
                  {clockIn && (
                    <TouchableOpacity
                      onPress={() => setClockIn(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      testID="correction-clockin-clear"
                    >
                      <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Clock-out */}
                <Text style={styles.label}>
                  Requested Clock-out <Text style={styles.optional}>(optional)</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, clockOut && styles.pickerBtnActive]}
                  onPress={() => setShowClockOutPicker(true)}
                  testID="correction-clockout-btn"
                >
                  <Ionicons name="time-outline" size={18} color={clockOut ? '#6357E8' : '#9CA3AF'} />
                  <Text style={[styles.pickerBtnText, !clockOut && styles.pickerBtnPlaceholder]}>
                    {clockOut ? toLocalTimeString(clockOut) : 'Select time'}
                  </Text>
                  {clockOut && (
                    <TouchableOpacity
                      onPress={() => setClockOut(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      testID="correction-clockout-clear"
                    >
                      <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {errors.time && (
                  <Text style={styles.errorText} testID="correction-time-error">{errors.time}</Text>
                )}

                {/* Reason */}
                <Text style={styles.label}>Reason</Text>
                <TextInput
                  style={[styles.textArea, errors.reason && styles.textAreaError]}
                  placeholder="Explain why a correction is needed (min 10 chars)"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  value={reason}
                  onChangeText={setReason}
                  testID="correction-reason-input"
                />
                {errors.reason && (
                  <Text style={styles.errorText} testID="correction-reason-error">{errors.reason}</Text>
                )}

                {mutation.isError && (
                  <Text style={styles.errorText} testID="correction-submit-error">
                    Failed to submit. Please try again.
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={mutation.isPending}
                  testID="correction-submit-btn"
                >
                  {mutation.isPending
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.submitBtnText}>Submit Correction</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>

      {/* Date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)}
          onChange={(_, selected) => {
            setShowDatePicker(false)
            if (selected) setDate(selected)
          }}
          testID="correction-date-picker"
        />
      )}

      {/* Clock-in time picker */}
      {showClockInPicker && (
        <DateTimePicker
          value={clockIn ?? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShowClockInPicker(false)
            if (selected) setClockIn(selected)
          }}
          testID="correction-clockin-picker"
        />
      )}

      {/* Clock-out time picker */}
      {showClockOutPicker && (
        <DateTimePicker
          value={clockOut ?? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShowClockOutPicker(false)
            if (selected) setClockOut(selected)
          }}
          testID="correction-clockout-picker"
        />
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  optional: {
    fontWeight: '400',
    color: '#9CA3AF',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerBtnActive: {
    borderColor: '#6357E8',
    backgroundColor: '#F5F3FF',
  },
  pickerBtnText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  pickerBtnPlaceholder: {
    color: '#9CA3AF',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 88,
    textAlignVertical: 'top',
  },
  textAreaError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#6357E8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  doneBtn: {
    backgroundColor: '#6357E8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 24,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
})
