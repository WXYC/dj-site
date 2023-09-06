import axios from "axios";

const apiServerUrl = process.env.REACT_APP_API_SERVER_URL;

export const callApi = async (options) => {
  try {
    const response = await axios(options.config);
    const { data } = response;

    return {
      data,
      error: null,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error;

      const { response } = axiosError;

      let message = "http request failed";

      if (response && response.statusText) {
        message = response.statusText;
      }

      if (axiosError.message) {
        message = axiosError.message;
      }

      if (response && response.data && response.data.message) {
        message = response.data.message;
      }

      return {
        data: null,
        error: {
          message,
        },
      };
    }

    return {
      data: null,
      error: {
        message: error.message,
      },
    };
  }
};

/**
 * @param {string} method - The HTTP method to use.
 * @returns {function} A function that takes a url and returns a function that takes data and returns a promise.
 */
const api_caller = (method) => {
  return (url) => {
    return async (data_in) => {
      const config = {
        method,
        url: `${apiServerUrl}/${url}`,
        data: data_in,
      };

      const { data, error } = await callApi({ config });

      return {
        data: data,
        error,
      };
    };
  }
};

/**
 * @description Note that this function cannot take a data parameter, despite the presence of the argument in the function signature.
 */
export const getter = api_caller("GET");

export const setter = api_caller("POST");

export const deleter = api_caller("DELETE");

export const updater = api_caller("PATCH");
    