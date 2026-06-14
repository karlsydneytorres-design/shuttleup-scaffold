import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuthStore()
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) Alert.alert('Sign in failed', error.message)
    else router.replace('/(tabs)/home')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>ShuttleUp</Text>
      <Text style={styles.tagline}>Find games. Track wins. Play more.</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/auth/register')}>
        <Text style={styles.link}>No account? Sign up</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  logo: { fontSize: 34, fontWeight: '700', color: '#1D9E75', textAlign: 'center', marginBottom: 6 },
  tagline: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 40 },
  input: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12 },
  btn: { backgroundColor: '#1D9E75', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#1D9E75', marginTop: 20, fontSize: 14 },
})
