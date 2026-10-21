import { markRaw } from 'vue'
import { createStore } from 'vuex'
import { createS3Client } from '@/utils/s3-client'
import { readAppConfig, saveAppConfig } from '@/utils/app-config-storage'
import {
  migrateFromDisk,
  buildPersistPayload,
  flatActiveProfile,
  emptyProfile
} from './config-migrate'

function findIndex(profiles, id) {
  return profiles.findIndex(p => p.id === id)
}

let _configLoadPromise = null

export default createStore({
  state: {
    profiles: [],
    activeProfileId: '',
    s3Instance: null,
    isConfigured: false,
    configLoaded: false,
    browsingPaths: {},
    busyOperation: false,
    hasPendingUploads: false,
    switchingProfile: false
  },
  mutations: {
    rememberDirectory(state, path) {
      state.browsingPaths[state.activeProfileId] = path
    },
    setBusyOperation(state, busy) {
      state.busyOperation = busy
    },
    setPendingUploads(state, pending) {
      state.hasPendingUploads = pending
    },
    setProfileSwitching(state, switching) {
      state.switchingProfile = switching
    },
    setProfilesState(state, { profiles, activeProfileId }) {
      state.profiles = profiles.map(p => ({ ...p, cdnBaseUrls: [...(p.cdnBaseUrls || [])] }))
      state.activeProfileId = activeProfileId || (profiles[0] && profiles[0].id) || ''
      const ap = state.profiles.find(p => p.id === state.activeProfileId)
      state.isConfigured = !!(
        ap &&
        ap.accessKeyId &&
        ap.secretAccessKey &&
        ap.region &&
        ap.bucketName
      )
    },
    setConfigLoaded(state, loaded) {
      state.configLoaded = loaded
    },
    initS3Instance(state) {
      const ap = state.profiles.find(p => p.id === state.activeProfileId)
      try {
        if (
          ap &&
          ap.accessKeyId &&
          ap.secretAccessKey &&
          ap.region &&
          ap.bucketName
        ) {
          state.s3Instance = markRaw(createS3Client(ap))
        } else {
          state.s3Instance = null
        }
      } catch (e) {
        console.error('初始化S3失败:', e)
        state.s3Instance = null
      }
    }
  },
  actions: {
    loadAwsConfig({ commit, state }) {
      if (state.configLoaded) return Promise.resolve()
      if (_configLoadPromise) return _configLoadPromise
      _configLoadPromise = (async () => {
        try {
          const raw = await readAppConfig()
          const { profiles, activeProfileId } = migrateFromDisk(raw)
          commit('setProfilesState', { profiles, activeProfileId })
          commit('initS3Instance')
        } catch (e) {
          console.error('加载配置失败:', e)
          const p = emptyProfile()
          commit('setProfilesState', { profiles: [p], activeProfileId: p.id })
        } finally {
          commit('setConfigLoaded', true)
        }
      })()
      return _configLoadPromise
    },

    async persistProfiles({ state, commit, dispatch }, { profiles, activeProfileId }) {
      const id = activeProfileId != null ? activeProfileId : state.activeProfileId
      const payload = buildPersistPayload(profiles, id)
      await saveAppConfig(payload)
      commit('setProfilesState', { profiles, activeProfileId: id })
      dispatch('initS3')
    },

    /** 保存当前正在编辑的连接（自定义域名至多一项） */
    async saveActiveProfile(
      { state, dispatch },
      { accessKeyId, secretAccessKey, region, bucketName, name, cdnBaseUrls }
    ) {
      const profiles = state.profiles.map(p => ({ ...p, cdnBaseUrls: [...(p.cdnBaseUrls || [])] }))
      const idx = findIndex(profiles, state.activeProfileId)
      if (idx < 0) throw new Error('未找到当前连接')
      const bases = Array.isArray(cdnBaseUrls)
        ? cdnBaseUrls.map(u => String(u).trim().replace(/\/$/, '')).filter(Boolean).slice(0, 1)
        : []
      profiles[idx] = {
        ...profiles[idx],
        name: (name || profiles[idx].name || '未命名').slice(0, 64),
        accessKeyId: accessKeyId != null ? String(accessKeyId) : '',
        secretAccessKey: secretAccessKey != null ? String(secretAccessKey) : '',
        region: region || 'us-east-1',
        bucketName: bucketName != null ? String(bucketName) : '',
        cdnBaseUrls: bases
      }
      await dispatch('persistProfiles', {
        profiles,
        activeProfileId: state.activeProfileId
      })
    },

    async switchProfile({ state, commit, dispatch }, profileId) {
      if (state.busyOperation || state.hasPendingUploads || state.switchingProfile) throw new Error('请先完成当前操作或清空待上传文件')
      if (!state.profiles.some(p => p.id === profileId)) return
      commit('setProfileSwitching', true)
      try {
        await dispatch('persistProfiles', {
          profiles: state.profiles,
          activeProfileId: profileId
        })
      } finally {
        commit('setProfileSwitching', false)
      }
    },

    async addProfile({ state, dispatch }) {
      const p = emptyProfile()
      p.name = `连接 ${state.profiles.length + 1}`
      const profiles = [...state.profiles.map(x => ({ ...x, cdnBaseUrls: [...(x.cdnBaseUrls || [])] })), p]
      await dispatch('persistProfiles', { profiles, activeProfileId: p.id })
    },

    async removeProfile({ state, dispatch }, profileId) {
      if (state.profiles.length <= 1) {
        throw new Error('至少保留一个连接')
      }
      const profiles = state.profiles.filter(p => p.id !== profileId)
      const activeProfileId =
        state.activeProfileId === profileId ? profiles[0].id : state.activeProfileId
      await dispatch('persistProfiles', { profiles, activeProfileId })
    },

    initS3({ commit }) {
      commit('initS3Instance')
    }
  },
  getters: {
    profiles: s => s.profiles,
    activeProfileId: s => s.activeProfileId,
    activeProfile(state) {
      return state.profiles.find(p => p.id === state.activeProfileId) || null
    },
    awsConfig(state, getters) {
      return flatActiveProfile(getters.activeProfile)
    },
    s3Instance: s => s.s3Instance,
    isConfigured: s => s.isConfigured,
    configLoaded: s => s.configLoaded,
    currentDirectory: s => s.browsingPaths[s.activeProfileId] || ''
  }
})
