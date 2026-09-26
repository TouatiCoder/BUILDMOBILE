package com.example.data.api

import com.example.data.security.SessionManager
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient(private val sessionManager: SessionManager) {

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()

        // Include auth token both in Authorization header and Cookie for maximum compatibility
        val token = sessionManager.authToken
        if (!token.isNullOrEmpty()) {
            builder.addHeader("Authorization", "Bearer $token")
            builder.addHeader("Cookie", "auth-token=$token")
        }
        builder.addHeader("Accept", "application/json")
        builder.addHeader("User-Agent", "BuildStock-Android/1.0")

        val response = chain.proceed(builder.build())

        // Capture auth-token cookie if returned from login/refresh
        val cookies = response.headers("Set-Cookie")
        for (cookie in cookies) {
            if (cookie.startsWith("auth-token=")) {
                val tokenVal = cookie.substringAfter("auth-token=").substringBefore(";")
                if (tokenVal.isNotBlank()) {
                    sessionManager.authToken = tokenVal
                }
            }
        }

        response
    }

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    private val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    fun createService(): BuildStockApiService {
        var base = sessionManager.serverBaseUrl
        if (!base.endsWith("/")) {
            base = "$base/"
        }

        return Retrofit.Builder()
            .baseUrl(base)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(BuildStockApiService::class.java)
    }
}
