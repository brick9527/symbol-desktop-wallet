/**
 * Copyright 2020 NEM Foundation (https://nem.io)
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Component, Vue} from 'vue-property-decorator'
import {mapGetters} from 'vuex'

@Component({computed: {...mapGetters({
  currentLanguage: 'app/currentLanguage',
  languageList: 'app/languages',
})}})
export class LanguageSelectorTs extends Vue {
  /**
   * Currently active language
   * @see {Store.AppInfo}
   * @var {string}
   */
  public currentLanguage: string

  /**
   * List of available languages
   * @see {Store.AppInfo}
   * @var {any[]}
   */
  public languageList: {value: string, label: string}[]


  /**
   * Currently active language
   */
  get language() {
    return this.$i18n.locale
  }

  /**
   * Sets the new language
   */
  set language(language: string) {
    this.$i18n.locale = language
    window.localStorage.setItem('locale', language)
  }
}