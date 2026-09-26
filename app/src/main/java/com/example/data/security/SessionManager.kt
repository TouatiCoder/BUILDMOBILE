package com.example.data.security

import android.content.Context
import android.content.SharedPreferences
import com.example.data.model.User
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory

class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("buildstock_session", Context.MODE_PRIVATE)
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val userAdapter = moshi.adapter(User::class.java)

    companion object {
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USER_JSON = "user_json"
        private const val KEY_BIOMETRIC_ENABLED = "biometric_enabled"
        private const val KEY_SERVER_BASE_URL = "server_base_url"
        private const val KEY_SECURITY_METHOD = "security_method"
        const val DEFAULT_BASE_URL = "https://buildstock.pro" // fallback / configurable
    }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()
        }

    var serverBaseUrl: String
        get() = prefs.getString(KEY_SERVER_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) {
            var url = value.trim()
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://$url"
            }
            if (url.endsWith("/")) {
                url = url.substring(0, url.length - 1)
            }
            prefs.edit().putString(KEY_SERVER_BASE_URL, url).apply()
        }

    var isBiometricEnabled: Boolean
        get() = prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, value).apply()
        }

    var securityMethod: String
        get() = prefs.getString(KEY_SECURITY_METHOD, "password_only") ?: "password_only"
        set(value) {
            prefs.edit().putString(KEY_SECURITY_METHOD, value).apply()
        }

    var currentUser: User?
        get() {
            val json = prefs.getString(KEY_USER_JSON, null) ?: return null
            return try {
                userAdapter.fromJson(json)
            } catch (e: Exception) {
                null
            }
        }
        set(value) {
            if (value == null) {
                prefs.edit().remove(KEY_USER_JSON).apply()
            } else {
                val json = userAdapter.toJson(value)
                prefs.edit().putString(KEY_USER_JSON, json).apply()
            }
        }

    val isLoggedIn: Boolean
        get() = !authToken.isNullOrEmpty() && currentUser != null

    fun saveLogin(token: String, user: User) {
        authToken = token
        currentUser = user
        securityMethod = user.authMethod
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USER_JSON)
            .apply()
    }
}
