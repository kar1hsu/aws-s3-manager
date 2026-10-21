import {
  ArrowRight, Back, Box, Check, CircleCheck, CircleCheckFilled,
  CircleCloseFilled, Clock, Close, Delete, Document, DocumentCopy,
  Download, Edit, Files, Folder, FolderAdd, FolderOpened, InfoFilled,
  Link, Loading, Lock, MoreFilled, Picture, Plus, Refresh, Right,
  Search, Setting, Upload, VideoPause, View, Warning
} from '@element-plus/icons-vue'

// One icon vocabulary shared by native controls and Element Plus components.
const icons = {
  ArrowRight, Back, Box, Check, CircleCheck, CircleCheckFilled,
  CircleCloseFilled, Clock, Close, Delete, Document, DocumentCopy,
  Download, Edit, Files, Folder, FolderAdd, FolderOpened, InfoFilled,
  Link, Loading, Lock, MoreFilled, Picture, Plus, Refresh, Right,
  Search, Setting, Upload, VideoPause, View, Warning
}

export function registerIcons(app) {
  Object.entries(icons).forEach(([name, component]) => app.component(name, component))
}
