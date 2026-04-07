import { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'

interface CameraCaptureProps {
  visible: boolean
  onClose: () => void
  onCapture: (photoUri: string) => void
  title?: string
  locationText?: string
}

export function CameraCapture({ visible, onClose, onCapture, title = 'Take Photo', locationText }: CameraCaptureProps) {
  const [facing, setFacing] = useState<CameraType>('front')
  const [permission, requestPermission] = useCameraPermissions()
  const [isCapturing, setIsCapturing] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setIsCapturing(false)
    }
  }, [visible])

  if (!permission) {
    // Camera permissions are still loading
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#6357E8" />
        </View>
      </Modal>
    )
  }

  if (!permission.granted) {
    // Camera permissions not granted
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionText}>
              We need access to your camera to take your clock-in photo
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.permissionCancelButton} onPress={onClose}>
              <Text style={styles.permissionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return

    try {
      setIsCapturing(true)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6, // Compress to reduce file size
        base64: false,
      })

      if (photo) {
        onCapture(photo.uri)
        // Do NOT call onClose() here — parent closes camera via visible prop.
        // onClose() is reserved for user-initiated cancel (X button).
      }
    } catch (error) {
      console.error('Error taking picture:', error)
      alert('Failed to take picture. Please try again.')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Camera */}
        <>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
              {/* Camera overlay with guide */}
              <View style={styles.cameraOverlay}>
                <View style={styles.guidanceContainer}>
                  <View style={styles.faceGuide}>
                    <View style={[styles.faceGuideCorner, styles.cornerTopLeft]} />
                    <View style={[styles.faceGuideCorner, styles.cornerTopRight]} />
                    <View style={[styles.faceGuideCorner, styles.cornerBottomLeft]} />
                    <View style={[styles.faceGuideCorner, styles.cornerBottomRight]} />
                  </View>
                  <Text style={styles.guidanceText}>Position your face in the frame</Text>
                  <View style={styles.tipsContainer}>
                    <Text style={styles.tipText}>• Look straight at the camera</Text>
                    <Text style={styles.tipText}>• Ensure good lighting</Text>
                    <Text style={styles.tipText}>• Remove glasses if possible</Text>
                  </View>
                </View>
              </View>
            </CameraView>

            {/* Bottom controls */}
            <View style={styles.controls}>
              <View style={styles.flipButton} />

              <TouchableOpacity
                style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
                onPress={takePicture}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="large" color="#FFF" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>

              <View style={styles.flipButton} />
            </View>
          </>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guidanceContainer: {
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 300,
    borderRadius: 125,
    position: 'relative',
    marginBottom: 20,
  },
  faceGuideCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10B981',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 8,
  },
  guidanceText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 12,
  },
  tipsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  tipText: {
    fontSize: 13,
    color: '#FFF',
    marginBottom: 4,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  flipButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6357E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FFF',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#6357E8',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  permissionCancelButton: {
    paddingVertical: 14,
  },
  permissionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
})
