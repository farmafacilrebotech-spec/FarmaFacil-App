plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "solutions.farmafacil.kiosk"
    compileSdk = 34

    defaultConfig {
        applicationId = "solutions.farmafacil.kiosk"
        minSdk = 30 // Android 11
        targetSdk = 34
        versionCode = 16
        versionName = "0.2.15"

        // 0 = auto (getPrinterType / prefs / demo SDK). Override dots si se calibra en POS.
        buildConfigField("int", "ICOD_PRINTABLE_WIDTH_DOTS", "0")

        // ABI del POS no confirmada por getprop; se empaquetan las ARM habituales.
        // Android selecciona en runtime. Sin libusb1.0 (UsbNativeAPI / root).
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("production") {
            dimension = "environment"
            // applicationId = solutions.farmafacil.kiosk (+ .debug en debug)
            buildConfigField(
                "String",
                "KIOSK_BASE_URL",
                "\"https://app.farmafacil.solutions/k\""
            )
            buildConfigField(
                "String",
                "ALLOWED_ORIGIN_HOST",
                "\"app.farmafacil.solutions\""
            )
            buildConfigField("boolean", "IS_STAGING", "false")
            buildConfigField("boolean", "STRICT_ORIGIN", "false")
            buildConfigField("boolean", "ENABLE_DIAGNOSTICS", "false")
            buildConfigField("boolean", "ENABLE_PERF_PROBE", "false")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            resValue("string", "app_name", "FarmaFácil TEST")
            buildConfigField(
                "String",
                "KIOSK_BASE_URL",
                "\"https://farmafacil-staging.vercel.app/k\""
            )
            buildConfigField(
                "String",
                "ALLOWED_ORIGIN_HOST",
                "\"farmafacil-staging.vercel.app\""
            )
            buildConfigField("boolean", "IS_STAGING", "true")
            // Staging: solo el host allowlist (sin comodín *.vercel.app).
            buildConfigField("boolean", "STRICT_ORIGIN", "true")
            // Diagnóstico USB/impresión habilitado para pruebas de campo.
            buildConfigField("boolean", "ENABLE_DIAGNOSTICS", "true")
            buildConfigField("boolean", "ENABLE_PERF_PROBE", "true")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            // Diagnóstico: BuildConfig.DEBUG || ENABLE_DIAGNOSTICS (flavor staging).
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("androidx.activity:activity-ktx:1.8.2")

    // ICOD SDK 3.1.8 (USBAPI / PrinterAPI). No UsbNativeAPI.
    implementation(files("libs/icod_3.1.8.jar"))

    // QR del ticket (codificación pura Java, sin cámara).
    implementation("com.google.zxing:core:3.5.3")

    testImplementation("junit:junit:4.13.2")
    // org.json real en JVM (el stub de android.jar no parsea en unit tests).
    testImplementation("org.json:json:20240303")
}
