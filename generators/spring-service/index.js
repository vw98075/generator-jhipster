/**
 * Copyright 2013-2021 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable consistent-return */
const _ = require('lodash');

const BaseBlueprintGenerator = require('../generator-base-blueprint');
const { INITIALIZING_PRIORITY, PROMPTING_PRIORITY, LOADING_PRIORITY, DEFAULT_PRIORITY, WRITING_PRIORITY } =
  require('../../lib/constants/priorities.cjs').compat;

const constants = require('../generator-constants');
const statistics = require('../statistics');
const { OptionNames } = require('../../jdl/jhipster/application-options');
const { GENERATOR_SPRING_SERVICE } = require('../generator-list');

const { BASE_NAME, PACKAGE_NAME, PACKAGE_FOLDER, DATABASE_TYPE } = OptionNames;
const SERVER_MAIN_SRC_DIR = constants.SERVER_MAIN_SRC_DIR;

module.exports = class extends BaseBlueprintGenerator {
  constructor(args, options, features) {
    super(args, options, features);

    this.argument('name', { type: String, required: true });
    this.name = this.options.name;

    this.option('default', {
      type: Boolean,
      default: false,
      description: 'default option',
    });
    this.defaultOption = this.options.default;
  }

  async _postConstruct() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints(GENERATOR_SPRING_SERVICE, { arguments: [this.name] });
    }
  }

  // Public API method used by the getter and also by Blueprints
  _initializing() {
    return {
      validateFromCli() {
        this.checkInvocationFromCLI();
      },

      initializing() {
        this.log(`The service ${this.name} is being created.`);
        const configuration = this.config;
        this.baseName = configuration.get(BASE_NAME);
        this.packageName = configuration.get(PACKAGE_NAME);
        this.packageFolder = configuration.get(PACKAGE_FOLDER);
        this.databaseType = configuration.get(DATABASE_TYPE);
      },
    };
  }

  get [INITIALIZING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._initializing();
  }

  // Public API method used by the getter and also by Blueprints
  _prompting() {
    return {
      prompting() {
        const prompts = [
          {
            type: 'confirm',
            name: 'useInterface',
            message: '(1/1) Do you want to use an interface for your service?',
            default: false,
          },
        ];
        if (!this.defaultOption) {
          const done = this.async();
          this.prompt(prompts).then(props => {
            this.useInterface = props.useInterface;
            done();
          });
        } else {
          this.useInterface = true;
        }
      },
    };
  }

  get [PROMPTING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._prompting();
  }

  // Public API method used by the getter and also by Blueprints
  _loading() {
    return {
      loadSharedConfig() {
        this.loadDerivedServerConfig();
      },
    };
  }

  get [LOADING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._loading();
  }

  // Public API method used by the getter and also by Blueprints
  _default() {
    return {
      insight() {
        statistics.sendSubGenEvent('generator', GENERATOR_SPRING_SERVICE, { interface: this.useInterface });
      },
    };
  }

  get [DEFAULT_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._default();
  }

  // Public API method used by the getter and also by Blueprints
  _writing() {
    return {
      write() {
        this.serviceClass = _.upperFirst(this.name) + (this.name.endsWith('Service') ? '' : 'Service');
        this.serviceInstance = _.lowerCase(this.serviceClass);

        this.template(
          `${this.fetchFromInstalledJHipster('spring-service/templates')}/${SERVER_MAIN_SRC_DIR}package/service/Service.java.ejs`,
          `${SERVER_MAIN_SRC_DIR + this.packageFolder}/service/${this.serviceClass}.java`
        );

        if (this.useInterface) {
          this.template(
            `${this.fetchFromInstalledJHipster(
              'spring-service/templates'
            )}/${SERVER_MAIN_SRC_DIR}package/service/impl/ServiceImpl.java.ejs`,
            `${SERVER_MAIN_SRC_DIR + this.packageFolder}/service/impl/${this.serviceClass}Impl.java`
          );
        }
      },
    };
  }

  get [WRITING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._writing();
  }
};
