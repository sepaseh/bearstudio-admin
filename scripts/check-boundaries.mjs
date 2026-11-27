import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import semver from "semver";
import ts from "typescript";

const repository = fileURLToPath(new URL("../", import.meta.url));
const productionPaths = [
  "src/features/files/addresses.ts",
  "src/features/files/components/ManagedImageField.tsx",
  "src/features/files/components/MediaPicker.tsx",
  "src/features/files/components/VideoSourcePicker.tsx",
  "src/features/home/Home.tsx",
  "src/features/home/api.ts",
  "src/features/home/index.ts",
  "src/features/home/types.ts",
  "src/features/home/useHome.ts",
  "src/features/projects/Projects.tsx",
  "src/features/projects/api.ts",
  "src/features/projects/components/project-form/ProjectForm.tsx",
  "src/features/projects/index.ts",
  "src/features/projects/types.ts",
  "src/features/services/Services.tsx",
  "src/features/services/api.ts",
  "src/features/services/components/service-form/ServiceForm.tsx",
  "src/features/services/index.ts",
  "src/features/services/types.ts",
  "src/features/settings/AppearanceFields.tsx",
  "src/features/settings/SiteFields.tsx",
  "src/layouts/default/components/breadcrumbs/Breadcrumbs.tsx",
  "src/layouts/default/components/navigation/Navigation.tsx",
  "src/layouts/default/components/breadcrumbs/index.ts",
  "src/layouts/default/components/navigation/index.ts",
  "src/shared/storage/hooks/index.ts",
  "src/shared/ui/error-boundary/ErrorFallback.tsx",
  "src/main.tsx",
  "src/app/App.tsx",
  "src/app/Routes.tsx",
  "src/app/config/index.ts",
  "src/app/config/routes.ts",
  "src/app/contexts/Core.ts",
  "src/app/contexts/index.ts",
  "src/app/hooks/index.ts",
  "src/app/hooks/useAntd.ts",
  "src/app/hooks/useCore.ts",
  "src/app/lib/access.ts",
  "src/app/lib/index.ts",
  "src/features/not-found/NotFound.tsx",
  "src/app/providers/antd/Antd.tsx",
  "src/app/providers/core/Core.tsx",
  "src/app/providers/index.ts",
  "src/features/auth/api.ts",
  "src/features/auth/index.ts",
  "src/features/auth/types.ts",
  "src/features/dashboard/Dashboard.tsx",
  "src/features/dashboard/index.ts",
  "src/features/files/api.ts",
  "src/features/files/index.ts",
  "src/features/files/types.ts",
  "src/features/login/Login.tsx",
  "src/features/login/index.ts",
  "src/features/roles/Roles.tsx",
  "src/features/roles/api.ts",
  "src/features/roles/components/role-form/RoleForm.tsx",
  "src/features/roles/index.ts",
  "src/features/roles/types.ts",
  "src/features/settings/Settings.tsx",
  "src/features/settings/api.ts",
  "src/features/settings/index.ts",
  "src/features/settings/types.ts",
  "src/features/users/Users.tsx",
  "src/features/users/api.ts",
  "src/features/users/components/user-form/UserForm.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.tsx",
  "src/features/users/components/UserRolePicker.tsx",
  "src/features/users/constants.ts",
  "src/features/users/index.ts",
  "src/features/users/types.ts",
  "src/layouts/auth/Auth.tsx",
  "src/layouts/auth/index.ts",
  "src/layouts/default/Default.tsx",
  "src/layouts/default/index.ts",
  "src/layouts/default/types.ts",
  "src/shared/api/client.ts",
  "src/shared/api/config.ts",
  "src/shared/api/index.ts",
  "src/shared/api/session.ts",
  "src/shared/api/token.ts",
  "src/shared/api/types.ts",
  "src/shared/config/constants.ts",
  "src/shared/config/index.ts",
  "src/shared/contracts/appearance.ts",
  "src/shared/contracts/index.ts",
  "src/shared/hooks/index.ts",
  "src/shared/hooks/useGoBack.ts",
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/date.ts",
  "src/shared/i18n/dayjs/fa.ts",
  "src/shared/i18n/index.ts",
  "src/shared/i18n/locales.ts",
  "src/shared/i18n/locales/ar.ts",
  "src/shared/i18n/locales/de.ts",
  "src/shared/i18n/locales/en.ts",
  "src/shared/i18n/locales/es.ts",
  "src/shared/i18n/locales/fa.ts",
  "src/shared/i18n/locales/fr.ts",
  "src/shared/i18n/locales/it.ts",
  "src/shared/i18n/locales/pt.ts",
  "src/shared/i18n/locales/ru.ts",
  "src/shared/i18n/locales/tr.ts",
  "src/shared/lib/error.ts",
  "src/shared/lib/index.ts",
  "src/shared/lib/transform.ts",
  "src/shared/storage/compact.ts",
  "src/shared/storage/hooks/useLocalStorageWatcher.ts",
  "src/shared/storage/index.ts",
  "src/shared/storage/state.ts",
  "src/shared/storage/theme.ts",
  "src/shared/ui/digits-input/DigitsInput.tsx",
  "src/shared/ui/digits-input/index.ts",
  "src/shared/ui/error-boundary/ErrorBoundary.tsx",
  "src/shared/ui/error-boundary/index.ts",
  "src/shared/ui/password-fields/PasswordFields.tsx",
  "src/shared/ui/password-fields/index.ts",
  "src/shared/ui/route-loading/RouteLoading.tsx",
  "src/shared/ui/route-loading/index.ts",
  "src/GlobalStyle.tsx",
  "src/app/providers/antd/index.ts",
  "src/app/providers/core/index.ts",
  "src/shared/hooks/useAbortController.ts",
  "src/shared/hooks/useLock.ts",
  "src/shared/ui/ImageThumbnail.tsx",
  "src/shared/ui/MediaUploadCard.tsx",
  "src/shared/ui/MediaUploadPlaceholder.tsx",
  "src/shared/ui/image-upload/ImageUpload.tsx",
  "src/shared/ui/image-upload/image.ts",
  "src/shared/ui/image-upload/index.ts",
  "src/shared/ui/video-upload/VideoUpload.tsx",
  "src/shared/ui/video-upload/index.ts",
  "src/shared/ui/video-upload/thumbnail.ts",
  "src/features/users/components/user-form/index.ts",
  "src/features/users/components/user-role-form/index.ts",
  "src/shared/hooks/useDebouncedFilters.ts",
  "src/shared/hooks/useFilterParams.ts",
  "src/shared/hooks/useUploadActivity.ts",
  "src/shared/lib/pagination.ts",
  "src/shared/lib/password.ts",
  "src/app/index.ts",
  "src/features/not-found/index.ts",
  "src/index.ts",
  "src/features/faqs/Faqs.tsx",
  "src/features/faqs/api.ts",
  "src/features/faqs/components/faq-form/FaqForm.tsx",
  "src/features/faqs/index.ts",
  "src/features/faqs/types.ts",
  "src/shared/ui/sortable-table/SortableTable.tsx",
  "src/shared/ui/sortable-table/index.ts",
  "src/shared/ui/sortable-table/reorder-rows.ts",
  "src/features/article-categories/ArticleCategories.tsx",
  "src/features/article-categories/api.ts",
  "src/features/article-categories/components/article-category-form/ArticleCategoryForm.tsx",
  "src/features/article-categories/index.ts",
  "src/features/article-categories/types.ts",
  "src/features/articles/Articles.tsx",
  "src/features/articles/api.ts",
  "src/features/articles/components/article-form/ArticleForm.tsx",
  "src/features/articles/index.ts",
  "src/features/articles/types.ts",
  "src/shared/ui/rich-text-editor/LazyRichTextEditor.tsx",
  "src/shared/ui/rich-text-editor/RichTextEditor.tsx",
  "src/shared/ui/rich-text-editor/index.ts",
];
const runtimeImports = {
  "src/features/files/components/ManagedImageField.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/files/components/MediaPicker.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/files/components/VideoSourcePicker.tsx": [
    "antd",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/home/Home.tsx": ["antd", "react-i18next"],
  "src/features/home/useHome.ts": [
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/projects/Projects.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/projects/components/project-form/ProjectForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/services/Services.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/services/components/service-form/ServiceForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/settings/AppearanceFields.tsx": ["antd", "react-i18next"],
  "src/features/settings/SiteFields.tsx": ["antd", "react-i18next"],
  "src/features/articles/Articles.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/articles/components/article-form/ArticleForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/shared/ui/rich-text-editor/LazyRichTextEditor.tsx": ["antd", "react"],
  "src/shared/ui/rich-text-editor/RichTextEditor.tsx": [
    "antd",
    "antd-style",
    "react",
    "react-i18next",
    "react-quill-new",
  ],

  "src/features/article-categories/ArticleCategories.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/article-categories/components/article-category-form/ArticleCategoryForm.tsx":
    ["antd", "axios", "react", "react-i18next", "react-router"],
  "src/features/faqs/Faqs.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/faqs/components/faq-form/FaqForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/shared/ui/sortable-table/SortableTable.tsx": [
    "@dnd-kit/core",
    "@dnd-kit/sortable",
    "@dnd-kit/utilities",
    "antd",
    "lucide-react",
    "react",
  ],
  "src/shared/ui/sortable-table/reorder-rows.ts": ["@dnd-kit/sortable"],
  "src/layouts/default/components/breadcrumbs/Breadcrumbs.tsx": [
    "antd",
    "react-i18next",
    "react-router",
  ],
  "src/layouts/default/components/navigation/Navigation.tsx": [
    "antd",
    "react-i18next",
    "react-router",
  ],
  "src/GlobalStyle.tsx": ["antd-style"],
  "src/shared/hooks/useAbortController.ts": ["react"],
  "src/shared/hooks/useDebouncedFilters.ts": ["react"],
  "src/shared/hooks/useFilterParams.ts": ["react", "react-router"],
  "src/shared/hooks/useLock.ts": ["react"],
  "src/shared/hooks/useUploadActivity.ts": ["react"],
  "src/shared/ui/ImageThumbnail.tsx": ["antd"],
  "src/shared/ui/MediaUploadCard.tsx": [
    "antd",
    "antd-style",
    "lucide-react",
    "react-i18next",
  ],
  "src/shared/ui/MediaUploadPlaceholder.tsx": ["antd", "lucide-react"],
  "src/shared/ui/image-upload/ImageUpload.tsx": [
    "antd",
    "antd-img-crop",
    "react",
    "react-i18next",
  ],
  "src/shared/ui/video-upload/VideoUpload.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
  ],
  "src/shared/ui/error-boundary/ErrorFallback.tsx": ["antd", "react-i18next"],
  "src/main.tsx": ["react", "react-dom/client"],
  "src/app/App.tsx": ["react", "react-i18next"],
  "src/app/Routes.tsx": ["react", "react-router", "react-router/dom"],
  "src/app/contexts/Core.ts": ["react"],
  "src/app/hooks/useAntd.ts": ["antd", "react"],
  "src/app/hooks/useCore.ts": ["react"],
  "src/features/not-found/NotFound.tsx": [
    "antd",
    "react-i18next",
    "react-router",
  ],
  "src/app/providers/antd/Antd.tsx": [
    "antd",
    "antd/locale/ar_EG",
    "antd/locale/de_DE",
    "antd/locale/en_GB",
    "antd/locale/es_ES",
    "antd/locale/fa_IR",
    "antd/locale/fr_FR",
    "antd/locale/it_IT",
    "antd/locale/pt_PT",
    "antd/locale/ru_RU",
    "antd/locale/tr_TR",
    "react",
  ],
  "src/app/providers/core/Core.tsx": [
    "antd",
    "dayjs",
    "react",
    "react-i18next",
  ],
  "src/features/login/Login.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/layouts/auth/Auth.tsx": ["react", "react-router"],
  "src/layouts/default/Default.tsx": [
    "axios",
    "antd",
    "antd-style",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/shared/hooks/useGoBack.ts": ["react", "react-router"],
  "src/shared/storage/hooks/useLocalStorageWatcher.ts": ["react"],
  "src/shared/ui/digits-input/DigitsInput.tsx": ["antd", "react"],
  "src/shared/ui/error-boundary/ErrorBoundary.tsx": [
    "antd",
    "react",
    "react-i18next",
  ],
  "src/shared/ui/password-fields/PasswordFields.tsx": ["antd", "react-i18next"],
  "src/shared/ui/route-loading/RouteLoading.tsx": ["antd", "react-i18next"],
  "src/features/auth/api.ts": ["axios"],
  "src/shared/api/client.ts": ["axios"],
  "src/shared/i18n/index.ts": ["i18next", "react-i18next"],
  "src/shared/i18n/date.ts": [
    "dayjs",
    "jalaliday",
    "dayjs/plugin/calendar",
    ...["ar", "de", "en-gb", "es", "fr", "it", "pt", "ru", "tr"].map(
      (code) => "dayjs/locale/" + code,
    ),
  ],
  "src/features/dashboard/Dashboard.tsx": ["antd-style"],
  "src/features/dashboard/index.ts": [],
  "src/features/roles/Roles.tsx": [
    "antd",
    "antd-style",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/roles/components/role-form/RoleForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/roles/index.ts": [],
  "src/features/settings/Settings.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/settings/index.ts": [],
  "src/features/users/Users.tsx": [
    "antd",
    "antd-style",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/users/components/user-form/UserForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/users/components/UserRolePicker.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
  ],
  "src/features/users/components/user-role-form/UserRoleForm.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/users/constants.ts": [],
  "src/features/users/index.ts": [],
};
const typeImports = {
  "src/features/articles/Articles.tsx": ["antd"],
  "src/features/articles/components/article-form/ArticleForm.tsx": ["antd"],
  "src/shared/ui/rich-text-editor/LazyRichTextEditor.tsx": ["react"],
  "src/shared/ui/rich-text-editor/RichTextEditor.tsx": ["react"],

  "src/features/article-categories/ArticleCategories.tsx": ["antd"],
  "src/features/article-categories/components/article-category-form/ArticleCategoryForm.tsx":
    ["antd"],
  "src/features/faqs/Faqs.tsx": ["antd"],
  "src/features/faqs/components/faq-form/FaqForm.tsx": ["antd"],
  "src/shared/ui/sortable-table/SortableTable.tsx": [
    "@dnd-kit/core",
    "antd",
    "react",
  ],
  "src/shared/ui/sortable-table/reorder-rows.ts": ["@dnd-kit/core"],
  "src/layouts/default/components/breadcrumbs/Breadcrumbs.tsx": ["i18next"],
  "src/layouts/default/components/navigation/Navigation.tsx": [
    "antd",
    "i18next",
  ],
  "src/shared/api/types.ts": ["axios"],
  "src/app/App.tsx": ["react"],
  "src/app/Routes.tsx": ["react", "react-router"],
  "src/app/config/routes.ts": ["i18next"],
  "src/app/providers/antd/Antd.tsx": ["antd", "react"],
  "src/app/providers/core/Core.tsx": ["react"],
  "src/features/login/Login.tsx": ["antd"],
  "src/layouts/default/Default.tsx": ["antd"],
  "src/shared/hooks/useGoBack.ts": ["react-router"],
  "src/shared/ui/digits-input/DigitsInput.tsx": ["antd"],
  "src/shared/ui/MediaUploadCard.tsx": ["react"],
  "src/shared/ui/MediaUploadPlaceholder.tsx": ["react"],
  "src/shared/api/client.ts": ["axios"],
  "src/features/dashboard/Dashboard.tsx": [],
  "src/features/dashboard/index.ts": [],
  "src/features/roles/Roles.tsx": ["antd"],
  "src/features/roles/components/role-form/RoleForm.tsx": [],
  "src/features/roles/index.ts": [],
  "src/features/settings/Settings.tsx": ["antd"],
  "src/features/settings/index.ts": [],
  "src/features/users/Users.tsx": ["antd"],
  "src/features/users/components/user-form/UserForm.tsx": [],
  "src/features/users/components/user-role-form/UserRoleForm.tsx": [],
  "src/features/users/constants.ts": [],
  "src/features/users/index.ts": [],
};
const wireImports = {
  "src/features/home/types.ts": [
    "src/features/files/index.ts",
    "src/shared/contracts/index.ts",
  ],
  "src/features/projects/types.ts": [
    "src/features/files/index.ts",
    "src/shared/contracts/index.ts",
  ],
  "src/features/services/types.ts": ["src/shared/contracts/index.ts"],
  "src/features/articles/types.ts": [],

  "src/features/article-categories/types.ts": ["src/shared/contracts/index.ts"],
  "src/features/faqs/types.ts": ["src/shared/contracts/index.ts"],
  "src/features/auth/types.ts": [],
  "src/features/roles/types.ts": [],
  "src/features/files/types.ts": [],
  "src/features/users/types.ts": [
    "src/features/roles/index.ts",
    "src/shared/api/index.ts",
    "src/features/users/constants.ts",
  ],
  "src/features/settings/types.ts": [
    "src/features/files/index.ts",
    "src/shared/contracts/index.ts",
    "src/shared/i18n/index.ts",
  ],
};
const crossFeatureImports = {
  runtime: {},
  type: {},
};
const featureAppImports = new Set([
  "src/app/config/index.ts",
  "src/app/config/routes.ts",
  "src/app/hooks/index.ts",
  "src/app/hooks/useAntd.ts",
  "src/app/hooks/useCore.ts",
  "src/app/lib/access.ts",
  "src/app/lib/index.ts",
]);
const namedCrossFeatureImports = {
  runtime: {
    "src/features/home/Home.tsx": {
      "src/features/files/index.ts": [
        "ManagedImagePicker",
        "VideoSourcePicker",
      ],
    },
    "src/features/projects/components/project-form/ProjectForm.tsx": {
      "src/features/files/index.ts": [
        "ManagedImagePicker",
        "parseHttpsAddress",
        "VideoSourcePicker",
      ],
      "src/features/services/index.ts": ["fetchServices"],
    },
    "src/features/services/components/service-form/ServiceForm.tsx": {
      "src/features/files/index.ts": ["ManagedImagePicker"],
    },
    "src/features/settings/AppearanceFields.tsx": {
      "src/features/files/index.ts": ["ManagedImagePicker"],
    },
    "src/features/articles/Articles.tsx": {
      "src/features/article-categories/index.ts": ["fetchArticleCategories"],
    },
    "src/features/articles/components/article-form/ArticleForm.tsx": {
      "src/features/files/index.ts": ["ManagedImagePicker"],
    },

    "src/features/login/Login.tsx": {
      "src/features/auth/index.ts": ["login"],
    },
    "src/features/settings/Settings.tsx": {
      "src/features/files/index.ts": ["uploadFile"],
    },
    "src/features/users/Users.tsx": {
      "src/features/roles/index.ts": ["fetchRoles"],
    },
  },
  type: {
    "src/features/home/Home.tsx": {
      "src/features/files/index.ts": ["VideoSource"],
    },
    "src/features/home/types.ts": {
      "src/features/files/index.ts": ["VideoReference", "VideoSource"],
    },
    "src/features/projects/components/project-form/ProjectForm.tsx": {
      "src/features/files/index.ts": ["MediaSource", "VideoSource"],
    },
    "src/features/projects/types.ts": {
      "src/features/files/index.ts": [
        "MediaSource",
        "VideoReference",
        "VideoSource",
      ],
    },
    "src/features/articles/Articles.tsx": {
      "src/features/article-categories/index.ts": ["ArticleCategory"],
    },

    "src/features/login/Login.tsx": {
      "src/features/auth/index.ts": ["LoginParams"],
    },
    "src/features/settings/types.ts": {
      "src/features/files/index.ts": [
        "FileContext",
        "ImageProfiles",
        "ImageReference",
        "StoredFile",
      ],
    },
    "src/features/users/Users.tsx": {
      "src/features/roles/index.ts": ["Role"],
    },
    "src/features/users/components/user-role-form/UserRoleForm.tsx": {
      "src/features/roles/index.ts": ["Role"],
    },
    "src/features/users/types.ts": {
      "src/features/roles/index.ts": ["Role"],
    },
  },
};
const layoutContextConsumers = new Set([
  "src/features/files/components/ManagedImageField.tsx",
  "src/features/files/components/MediaPicker.tsx",
  "src/features/files/components/VideoSourcePicker.tsx",
  "src/features/home/useHome.ts",
  "src/features/projects/Projects.tsx",
  "src/features/projects/components/project-form/ProjectForm.tsx",
  "src/features/services/Services.tsx",
  "src/features/services/components/service-form/ServiceForm.tsx",
  "src/features/roles/Roles.tsx",
  "src/features/roles/components/role-form/RoleForm.tsx",
  "src/features/settings/Settings.tsx",
  "src/features/users/Users.tsx",
  "src/features/users/components/user-form/UserForm.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.tsx",
  "src/features/faqs/Faqs.tsx",
  "src/features/faqs/components/faq-form/FaqForm.tsx",
  "src/features/article-categories/ArticleCategories.tsx",
  "src/features/article-categories/components/article-category-form/ArticleCategoryForm.tsx",
  "src/features/articles/Articles.tsx",
  "src/features/articles/components/article-form/ArticleForm.tsx",
]);
const runtimeDependencies = new Set([
  "antd-img-crop",
  "antd-style",
  "lucide-react",
  "antd",
  "react-router",
  "axios",
  "react-dom",
  "dayjs",
  "i18next",
  "jalaliday",
  "react",
  "react-i18next",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "quill",
  "react-quill-new",
]);
const runtimePaths = new Set([
  "src/shared/i18n/index.ts",
  "src/shared/i18n/date.ts",
  "src/shared/lib/error.ts",
]);
const publishedModules = (root) =>
  new Set(productionPaths.map((file) => path.join(root, file)));
const stylesheetImports = {
  "src/shared/ui/rich-text-editor/RichTextEditor.tsx": {
    "quill/dist/quill.snow.css": "node_modules/quill/dist/quill.snow.css",
  },

  "src/main.tsx": { "./index.css": "src/index.css" },
};
const isErasedTypeReference = (node) => {
  if (ts.isImportTypeNode(node)) return true;
  if (ts.isImportDeclaration(node))
    return node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
  if (ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node))
    return node.isTypeOnly;
  return false;
};
export const inspectImports = (content, filename = "source.ts") => {
  const source = ts.createSourceFile(
    filename,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  const add = (node, value) => {
    const typeOnly = isErasedTypeReference(node);
    const bindings = [];
    if (ts.isImportDeclaration(node) && node.importClause?.name)
      bindings.push({ name: "default", typeOnly });
    let clause;
    if (ts.isImportDeclaration(node)) clause = node.importClause?.namedBindings;
    else if (ts.isExportDeclaration(node)) clause = node.exportClause;
    if (clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause)))
      for (const element of clause.elements)
        bindings.push({
          name: element.propertyName?.text ?? element.name.text,
          typeOnly: typeOnly || element.isTypeOnly,
        });
    else if (
      clause ||
      ts.isExportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node)
    )
      bindings.push({ name: "*", typeOnly });
    if (ts.isImportTypeNode(node)) {
      let qualifier = node.qualifier;
      while (qualifier && ts.isQualifiedName(qualifier))
        qualifier = qualifier.left;
      bindings.push({ name: qualifier?.text ?? "*", typeOnly: true });
    }
    imports.push({
      specifier:
        value && ts.isStringLiteralLike(value) ? value.text : undefined,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      typeOnly,
      bindings,
    });
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      add(node, node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      add(
        node,
        ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      add(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
};

const localSourceViolation = ({
  root,
  file,
  resolved,
  typeOnly,
  relativeFile,
  bindings = [],
}) => {
  const target = path.relative(root, resolved).split(path.sep).join("/");
  if (
    Object.hasOwn(wireImports, relativeFile) &&
    (!typeOnly || !wireImports[relativeFile].includes(target))
  )
    return "Owned HTTP types may import only their exact erased local wire vocabulary";
  const contracts = path.join(root, "src/shared/contracts");
  if (path.dirname(file) === contracts && path.dirname(resolved) !== contracts)
    return "Wire contracts must depend only on local pure contract modules";
  const catalogs = path.join(root, "src/shared/i18n") + path.sep;
  if (
    file.startsWith(catalogs) &&
    !runtimePaths.has(relativeFile) &&
    (!resolved.startsWith(catalogs) || runtimePaths.has(target))
  )
    return "Catalog data must depend only on its published pure local modules";
  const data =
    file === path.join(catalogs, "locales.ts") ||
    file.startsWith(path.join(catalogs, "locales") + path.sep) ||
    file.startsWith(path.join(catalogs, "dayjs") + path.sep);
  if (data && !typeOnly)
    return "Catalog and calendar data dependencies must be fully erased type references";
  if (
    relativeFile.startsWith("src/shared/") &&
    !target.startsWith("src/shared/")
  )
    return "Shared source may depend only on shared production modules";
  const sourceFeature = /^src\/features\/([^/]+)\//.exec(relativeFile)?.[1];
  const targetFeature = /^src\/features\/([^/]+)\//.exec(target)?.[1];
  const layoutContext =
    layoutContextConsumers.has(relativeFile) &&
    target === "src/layouts/default/index.ts" &&
    bindings.length === 1 &&
    bindings[0].typeOnly &&
    bindings[0].name === "DefaultLayoutContext";
  if (
    sourceFeature &&
    !targetFeature &&
    !target.startsWith("src/shared/") &&
    !featureAppImports.has(target) &&
    !layoutContext
  )
    return "Features may use only the approved app hooks, route configuration and access policy outside features and shared";
  if (
    sourceFeature &&
    targetFeature &&
    sourceFeature !== targetFeature &&
    !crossFeatureImports[typeOnly ? "type" : "runtime"][relativeFile]?.includes(
      target,
    ) &&
    (!bindings.length ||
      !bindings.every((binding) =>
        namedCrossFeatureImports[binding.typeOnly ? "type" : "runtime"][
          relativeFile
        ]?.[target]?.includes(binding.name),
      ))
  )
    return "Features may import another feature only through their exact approved API, hook or erased type contracts";
  return undefined;
};

const dependencyPackageName = (specifier, resolvedPackage) => {
  if (
    specifier === "react-dom/client" &&
    resolvedPackage === "@types/react-dom"
  )
    return "@types/react-dom";
  if (specifier.startsWith("react-router/")) return "react-router";
  if (specifier === "react" && resolvedPackage === "@types/react")
    return "@types/react";
  if (specifier.startsWith("dayjs/")) return "dayjs";
  if (specifier.startsWith("antd/locale/")) return "antd";
  return specifier;
};

const packageImportViolation = ({
  root,
  relativeFile,
  specifier,
  resolved,
  typeOnly,
  resolvedPackage,
}) => {
  const imports = typeOnly ? typeImports : runtimeImports;
  const packageName = dependencyPackageName(specifier, resolvedPackage);
  const packageRoot = path.join(root, "node_modules", packageName) + path.sep;
  if (
    imports[relativeFile]?.includes(specifier) &&
    resolvedPackage === packageName &&
    resolved?.startsWith(packageRoot)
  )
    return undefined;
  return "Pure source imports must use published local production modules; packages and Node builtins are not allowed except exact contained runtime-adapter dependencies";
};

export const boundaryViolation = ({
  root,
  file,
  specifier,
  resolved,
  typeOnly,
  resolvedPackage,
  bindings = [],
}) => {
  if (!specifier)
    return "Use literal module paths so source boundaries can be checked";
  const relativeFile = path.relative(root, file).split(path.sep).join("/");
  const stylesheet = stylesheetImports[relativeFile]?.[specifier];
  if (stylesheet)
    return !typeOnly &&
      !bindings.length &&
      resolved === path.join(root, stylesheet)
      ? undefined
      : "Stylesheets must use their exact contained application or vendor asset";
  if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
    return packageImportViolation({
      root,
      relativeFile,
      specifier,
      resolved,
      typeOnly,
      resolvedPackage,
    });
  if (!resolved || !publishedModules(root).has(path.resolve(resolved)))
    return "Pure source imports must resolve to published production modules in this repository";
  return localSourceViolation({
    root,
    file,
    resolved,
    typeOnly,
    relativeFile,
    bindings,
  });
};

const sourceFiles = async (directory, testRoot) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      if (entry.isSymbolicLink())
        throw new Error("Published source must not contain symbolic links");

      const filename = path.join(directory, entry.name);
      if (entry.isDirectory())
        return filename === testRoot ? [] : sourceFiles(filename, testRoot);

      return entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith(".d.ts") &&
        !entry.name.endsWith(".stories.tsx") &&
        !/\.(?:test|spec)\./.test(entry.name)
        ? [filename]
        : [];
    }),
  );
  return files.flat();
};

const registryRange = (version) =>
  typeof version === "string" &&
  version.trim() !== "" &&
  semver.validRange(version) !== null;

const registryOverrides = (value, dependencyFields) => {
  if (typeof value === "string" && value.startsWith("$")) {
    const reference = value.slice(1);
    return dependencyFields.some(
      (field) =>
        Object.hasOwn(field ?? {}, reference) &&
        registryRange(field[reference]),
    );
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value))
    return Object.values(value).every((child) =>
      registryOverrides(child, dependencyFields),
    );

  return registryRange(value);
};

export const checkBoundaries = async (requestedRoot = repository) => {
  const root = await realpath(requestedRoot);
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const violations = [];
  if (
    Object.hasOwn(manifest, "workspaces") ||
    Object.keys(manifest.dependencies ?? {}).some(
      (dependency) => !runtimeDependencies.has(dependency),
    ) ||
    Object.values(manifest.dependencies ?? {}).some(
      (version) =>
        typeof version !== "string" || !/^\^?\d+\.\d+\.\d+$/.test(version),
    )
  )
    violations.push(
      "The published phase must use one root package with only declared registry runtime dependencies and no workspaces",
    );
  const dependencyFields = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ];
  if (
    dependencyFields
      .slice(1)
      .some((field) =>
        Object.values(field ?? {}).some((version) => !registryRange(version)),
      ) ||
    !registryOverrides(manifest.overrides ?? {}, dependencyFields)
  )
    violations.push(
      "Dependencies and overrides must use registry versions without aliases or local source links",
    );

  const entries = await readdir(root);
  if (entries.some((entry) => ["apps", "packages"].includes(entry)))
    violations.push(
      "The standalone project must not contain multi-project source directories",
    );

  let publication;
  try {
    publication = JSON.parse(
      await readFile(path.join(root, ".github/bootstrap-policy.json"), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    publication?.schemaVersion === 1 &&
    (publication.phase === "repository-foundation" ||
      (publication.phase === "source-preparation" &&
        publication.publicationStage === "tooling")) &&
    publication.applicationReady === false &&
    Array.isArray(publication.allowedFiles) &&
    publication.allowedFiles.every(
      (file) =>
        typeof file === "string" && file !== "src" && !file.startsWith("src/"),
    )
  ) {
    if (entries.some((entry) => entry.toLowerCase() === "src"))
      violations.push(
        "The repository foundation must not contain unadmitted src source",
      );
    return { files: 0, violations };
  }

  const config = ts.readConfigFile(
    path.join(root, "tsconfig.app.json"),
    ts.sys.readFile,
  );
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );

  const { options, errors } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  );
  if (errors.length)
    throw new Error(
      errors
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, "\n"),
        )
        .join("\n"),
    );

  const cache = ts.createModuleResolutionCache(root, (value) => value, options);
  const allowed = publishedModules(root);
  const files = await sourceFiles(
    path.join(root, "src"),
    path.join(root, "src/test"),
  );
  const found = await Promise.all(
    files.map(async (file) => {
      if (!allowed.has(await realpath(file)))
        return ["Unpublished production module: " + path.relative(root, file)];

      const edges = inspectImports(await readFile(file, "utf8"), file);
      const failures = await Promise.all(
        edges.map(async (edge) => {
          const module =
            edge.specifier &&
            ts.resolveModuleName(edge.specifier, file, options, ts.sys, cache)
              .resolvedModule;
          const stylesheet =
            stylesheetImports[
              path.relative(root, file).split(path.sep).join("/")
            ]?.[edge.specifier];
          let resolved = module && (await realpath(module.resolvedFileName));
          if (stylesheet) {
            const filename = path.join(root, stylesheet);
            const entry = await lstat(filename).catch((error) => {
              if (error.code === "ENOENT") return undefined;
              throw error;
            });
            resolved =
              entry?.isFile() && !entry.isSymbolicLink()
                ? await realpath(filename)
                : undefined;
          }
          const violation = boundaryViolation({
            root,
            file,
            specifier: edge.specifier,
            resolved,
            typeOnly: edge.typeOnly,
            resolvedPackage: module?.packageId?.name,
            bindings: edge.bindings,
          });
          return violation
            ? path.relative(root, file) + ":" + edge.line + ": " + violation
            : undefined;
        }),
      );
      return failures.filter((value) => value !== undefined);
    }),
  );
  violations.push(...found.flat());
  return { files: files.length, violations };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkBoundaries();
  if (result.violations.length) {
    console.error(result.violations.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Closed admin source boundaries checked: " +
        result.files +
        " production modules.",
    );
}
