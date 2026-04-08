import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Calendar, DateData } from 'react-native-calendars'
import { Ionicons } from '@expo/vector-icons'

interface DateRangeCalendarProps {
  startDate: Date
  endDate: Date
  onStartDateChange: (date: Date) => void
  onEndDateChange: (date: Date) => void
  workingDays?: number
  availableDays?: number | null
  hasInsufficientBalance?: boolean
}

export function DateRangeCalendar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  workingDays = 0,
  availableDays = null,
  hasInsufficientBalance = false,
}: DateRangeCalendarProps) {
  const [selectingStart, setSelectingStart] = useState(true)

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleDayPress = (day: DateData) => {
    const selectedDate = new Date(day.year, day.month - 1, day.day)

    if (selectingStart) {
      // First click - set start date
      onStartDateChange(selectedDate)
      onEndDateChange(selectedDate) // Reset end date to same as start
      setSelectingStart(false)
    } else {
      // Second click - set end date
      const startTime = startDate.getTime()
      const selectedTime = selectedDate.getTime()

      if (selectedTime < startTime) {
        // If end date is before start, swap them
        onStartDateChange(selectedDate)
        onEndDateChange(startDate)
      } else {
        onEndDateChange(selectedDate)
      }
      setSelectingStart(true)
    }
  }

  // Generate marked dates for the calendar
  const getMarkedDates = () => {
    const marked: Record<string, any> = {}
    
    const startStr = formatDate(startDate)
    const endStr = formatDate(endDate)

    // If no dates selected, return empty
    if (!startDate) return marked

    // Mark start date
    marked[startStr] = {
      selected: true,
      startingDay: true,
      color: '#6357E8',
      textColor: '#FFFFFF',
    }

    // If same day (single day leave), only mark start
    if (startStr === endStr) {
      marked[startStr] = {
        selected: true,
        startingDay: true,
        endingDay: true,
        color: '#6357E8',
        textColor: '#FFFFFF',
      }
      return marked
    }

    // Mark end date
    if (endDate) {
      marked[endStr] = {
        selected: true,
        endingDay: true,
        color: '#6357E8',
        textColor: '#FFFFFF',
      }
    }

    // Mark dates in between
    const start = new Date(startDate)
    const end = new Date(endDate)
    const currentDate = new Date(start)
    currentDate.setDate(currentDate.getDate() + 1)

    while (currentDate < end) {
      const dateStr = formatDate(currentDate)
      marked[dateStr] = {
        selected: true,
        color: '#E0DFFE',
        textColor: '#6357E8',
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return marked
  }

  return (
    <View style={styles.container}>
      <View style={styles.calendarCard}>
        <Calendar
          markingType="period"
          markedDates={getMarkedDates()}
          onDayPress={handleDayPress}
          minDate={new Date().toISOString().split('T')[0]}
          theme={{
            backgroundColor: '#FFF',
            calendarBackground: '#FFF',
            textSectionTitleColor: '#6B7280',
            selectedDayBackgroundColor: '#6357E8',
            selectedDayTextColor: '#FFFFFF',
            todayTextColor: '#6357E8',
            dayTextColor: '#111827',
            textDisabledColor: '#D1D5DB',
            monthTextColor: '#111827',
            textMonthFontWeight: '600',
            textMonthFontSize: 16,
            arrowColor: '#6357E8',
          }}
        />

        {/* Selected dates display */}
        {startDate && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedLabel}>Selected:</Text>
            <Text style={styles.selectedValue}>
              {formatDisplayDate(startDate)}
              {formatDate(startDate) !== formatDate(endDate) && ` – ${formatDisplayDate(endDate)}`}
            </Text>

            {/* Working Days Info */}
            {workingDays > 0 && (
              <View
                style={[
                  styles.workingDaysCard,
                  hasInsufficientBalance ? styles.insufficientCard : styles.sufficientCard,
                ]}
              >
                <View style={styles.workingDaysRow}>
                  <Ionicons
                    name={hasInsufficientBalance ? 'alert-circle' : 'checkmark-circle'}
                    size={16}
                    color={hasInsufficientBalance ? '#F59E0B' : '#10B981'}
                  />
                  <Text
                    style={[
                      styles.workingDaysText,
                      { color: hasInsufficientBalance ? '#D97706' : '#059669' },
                    ]}
                  >
                    Working days: {workingDays} day{workingDays === 1 ? '' : 's'}
                  </Text>
                </View>
                {availableDays !== null && (
                  <Text style={styles.availableText}>
                    Available: {availableDays} day{availableDays === 1 ? '' : 's'}
                    {hasInsufficientBalance && ' (insufficient)'}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Helper Text */}
        <Text style={styles.helperText}>
          {selectingStart
            ? 'Select start date (or click same date twice for single day)'
            : 'Select end date'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  calendarCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  selectedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  selectedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  workingDaysCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  sufficientCard: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  insufficientCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  workingDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workingDaysText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availableText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
})
