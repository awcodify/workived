import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface CustomAlertButton {
  text: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive' | 'primary'
}

interface CustomAlertProps {
  visible: boolean
  title: string
  message?: string
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  imageUri?: string
  locationText?: string
  buttons: CustomAlertButton[]
  onDismiss?: () => void
}

export function CustomAlert({ 
  visible, 
  title, 
  message, 
  icon,
  iconColor = '#6357E8',
  imageUri,
  locationText,
  buttons, 
  onDismiss 
}: CustomAlertProps) {
  const handleButtonPress = (button: CustomAlertButton) => {
    if (button.onPress) {
      button.onPress()
    }
    if (onDismiss) {
      onDismiss()
    }
  }

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case 'cancel':
        return styles.cancelButton
      case 'destructive':
        return styles.destructiveButton
      case 'primary':
        return styles.primaryButton
      default:
        return styles.defaultButton
    }
  }

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case 'cancel':
        return styles.cancelButtonText
      case 'destructive':
        return styles.destructiveButtonText
      case 'primary':
        return styles.primaryButtonText
      default:
        return styles.defaultButtonText
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.alertContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.alertContent}>
            {icon && (
              <View style={styles.iconContainer}>
                <Ionicons name={icon as any} size={48} color={iconColor} />
              </View>
            )}
            
            <Text style={styles.title}>{title}</Text>
            
            {message && (
              <Text style={styles.message}>{message}</Text>
            )}

            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            )}
            
            {locationText && (
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={16} color="#6B7280" />
                <Text style={styles.locationText}>{locationText}</Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.button, getButtonStyle(button.style)]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text style={getButtonTextStyle(button.style)}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: '92%',
    maxWidth: 450,
    backgroundColor: '#FFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alertContent: {
    padding: 28,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  previewImage: {
    width: 280,
    height: 280,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  defaultButton: {
    backgroundColor: '#F3F4F6',
  },
  defaultButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  primaryButton: {
    backgroundColor: '#6357E8',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  destructiveButton: {
    backgroundColor: '#EF4444',
  },
  destructiveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
})
