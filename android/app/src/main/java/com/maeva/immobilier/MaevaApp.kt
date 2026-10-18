package com.maeva.immobilier

import android.app.Application
import com.maeva.immobilier.data.SessionStore
import com.maeva.immobilier.data.api.Reseau
import com.maeva.immobilier.data.local.AppDatabase
import com.maeva.immobilier.data.sync.SyncWorker

class MaevaApp : Application() {

    lateinit var session: SessionStore
        private set
    lateinit var reseau: Reseau
        private set
    lateinit var db: AppDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
        reseau = Reseau(session)
        db = AppDatabase.get(this)
        SyncWorker.programmer(this)
    }
}
