import Vue from 'vue'
import Vuex from 'vuex'
import AWS from 'aws-sdk'
import { readAppConfig, saveAppConfig } from '@/utils/app-config-storage'
import {
  migrateFromDisk,
  buildPersistPayload,
  flatActiveProfile,
  emptyProfile
} from './config-migrate'

Vue.use(Vuex)

function findIndex(profiles, id) {
  return profiles.findIndex(p => p.id === id)
}

export default new Vuex.Store({
  state: {
    profiles: [],
    activeProfileId: '',
    s3Instance: null,
    isConfigured: false,
    configLoaded: false
  },
  mutations: {
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
          state.s3Instance = new AWS.S3({
            accessKeyId: ap.accessKeyId,
            secretAccessKey: ap.secretAccessKey,
            region: ap.region,
            signatureVersion: 'v4',
            s3ForcePathStyle: true,
            endpoint: `https://s3.${ap.region}.amazonaws.com`
          })
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
    async loadAwsConfig({ commit }) {
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
    },

    async persistProfiles({ state, commit, dispatch }, { profiles, activeProfileId }) {
      const id = activeProfileId != null ? activeProfileId : state.activeProfileId
      const payload = buildPersistPayload(profiles, id)
      await saveAppConfig(payload)
      commit('setProfilesState', { profiles, activeProfileId: id })
      dispatch('initS3')
    },

    /** 保存当前正在编辑的连接（含多行域名） */
    async saveActiveProfile(
      { state, dispatch },
      { accessKeyId, secretAccessKey, region, bucketName, name, cdnBaseUrls }
    ) {
      const profiles = state.profiles.map(p => ({ ...p, cdnBaseUrls: [...(p.cdnBaseUrls || [])] }))
      const idx = findIndex(profiles, state.activeProfileId)
      if (idx < 0) throw new Error('未找到当前连接')
      const bases = Array.isArray(cdnBaseUrls)
        ? cdnBaseUrls.map(u => String(u).trim().replace(/\/$/, '')).filter(Boolean)
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

    async switchProfile({ state, dispatch }, profileId) {
      if (!state.profiles.some(p => p.id === profileId)) return
      await dispatch('persistProfiles', {
        profiles: state.profiles,
        activeProfileId: profileId
      })
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
    configLoaded: s => s.configLoaded
  }
})
