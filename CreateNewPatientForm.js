/* eslint-disable max-len,no-unused-vars,react/no-unescaped-entities */
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment-timezone';
import { makeStyles } from '@material-ui/styles';
import clsx from 'clsx';
import {
  TextField,
  Typography,
  Grid,
  Switch,
  Divider, Modal, Button, FormControlLabel, Checkbox, Select, MenuItem, FormControl, InputLabel
} from '@material-ui/core';
import { DatePicker } from '@material-ui/pickers';
import Alert from 'src/components/Alert';
import validate from 'validate.js';
import {
  changePatientField,
  changeSelectedDateOfPatientCalendar, changeSelectedDateOfTelehealthCalendar,
  fetchBasicDoctorInfo,
  fetchBusiness,
  getProviders,
  resetHasServerErrorValue,
  updateFilterProvider
} from 'src/actions';
import _, { isEmpty, upperCase } from 'lodash';
import { find } from 'lodash/collection';
import classNames from 'classnames';
import { map } from 'lodash-es/collection';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import { DAYS_OF_THE_WEEK } from 'src/views/ProviderOfficeCalendar';
import style from './CreateNewPatientForm.style';
import schema from './CreateNewPatientForm.schema';
import { GetTimezone } from '../../../helpers/timezone';
import months from '../../../constant/months';
import sendToPatientActions from '../../../constant/sendToPatientActions';
import { daysInMonth, decodePhoneNumber, encodePhoneNumber } from '../../../constant/function';
import { DefaultDateFormat } from '../../../constant/date-constant';
import procedureTypes from '../../../constant/procedureTypes';
import { commonService } from '../../../services';
import { DEFAULT_EMAIL } from '../../../constant/defaultEmail';
import {
  diagnosis as diagnosisAvailableSlots
} from '../../CreateNewPatientNoLogin/ScheduleDiagnosis/scheduleDiagnosisConstant';
import SimpleScheduleDiagnosisPatientCalendar
  from '../../CreateNewPatientNoLogin/ScheduleDiagnosis/SimplePatientCalendar';

import ScheduleDiagnosisListAvailableSlot from '../../CreateNewPatientNoLogin/ScheduleDiagnosis/ListAvailableSlot';
import { filterDoctorEmail, filterScheduleDiagnosisDoctorEmail } from '../../../helpers/function';
import { availableSlots as procedureAvailableSlots } from '../../CreateNewPatientNoLogin/Procedure/constant';
import { availableSlots as telehealthAvailableSlots } from '../../CreateNewPatientNoLogin/Teleheath/constant';
import { answerList } from '../../../constant/commonConst';
import { getReferralReceivedKeyAppointment, getReferralRequiredKeyAppointment } from '../../../helpers/appointmentStatus';
import {isAdministrators, isScheduler, isDoctorProvider, isStaff } from "../../../helpers/permission-check";
const useStyles = makeStyles(style);

function CreateNewPatientForm({ className, patientId, from, onChangeReferral }) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const providers = useSelector((state) => state.common.providers);
  const selectedDate = useSelector((state) => state.common.selectedDate);
  const collaborations = useSelector((state) => state.collaboration.collaborations);
  const newPatient = useSelector((state) => state.patient.newPatient);
  const hasServerError = useSelector((state) => state.patient.hasServerError);
  const serverErrorType = useSelector((state) => state.patient.serverErrorType);
  const { businessId, fetchedBusiness } = useSelector((state) => state.session);
  const [useDefaultTimezone, setUseDefaultTimezone] = useState(true);
  const serverErrorMessage = useSelector((state) => state.patient.serverErrorMessage);
  const { selectedPrep } = useSelector((state) => state.prep);
  const { isDoctor, email, userType } = useSelector((state) => state.session);
  const [highlightFields, setHighlightFields] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const currentDob = newPatient.dateOfBirth;
  const [dobDate, setDobDate] = useState(currentDob ? moment(currentDob, DefaultDateFormat).date() : 0);
  const [dobMonth, setDobMonth] = useState(currentDob ? moment(currentDob, DefaultDateFormat).month() + 1 : 0);
  const [dobYear, setDobYear] = useState(currentDob ? moment(currentDob, DefaultDateFormat).year() : 0);

  const [locationSelected, setLocationSelected] = useState('');
  const [providerSelected, setProviderSelected] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const [providerEmailSelected, setProviderEmailSelected] = useState('');
  const [listDoctorLocation, setListDoctorLocation] = useState([]);
  const [listProvidersValid, setListProvidersValid] = useState([]);
  const [listLocationsValid, setListLocationsValid] = useState([]);
  const [listProvidersDisplay, setListProvidersDisplay] = useState([]);
  const [listLocationsDisplay, setListLocationsDisplay] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [sendToPatientAction, setSendToPatientAction] = useState(sendToPatientActions);
  const facilities = useSelector((state) => state.common.facilities);

  const [formState, setFormState] = useState({
    isValid: false,
    values: {},
    touched: {},
    errors: {}
  });
  const [values, setValues] = useState({
    procedureTime: newPatient.procedureTime ? moment(newPatient.procedureTime) : moment()
  });
  const [calendarTrigger, setCalendarTrigger] = useState(null);
  const [visitCalendarTrigger, setVisitCalendarTrigger] = useState(null);
  const [officeLocations, setOfficeLocations] = useState([]);
  const [providerCalendars, setProviderCalendars] = useState([]);
  const [unavailableSlots, setUnavailableSlots] = useState([]);
  const [referralValue, setReferralValue] = useState('');
  const [backgroundAutoComplete, setBackgroundAutoComplete] = useState(false);

  const calendarOpen = Boolean(calendarTrigger);
  const calendarValue = values[calendarTrigger];

  const visitCalendarOpen = Boolean(visitCalendarTrigger);
  const visitCalendarValue = values[visitCalendarTrigger];
  const generalRegistrationTemplate = find(collaborations, (col) => col.name === 'General Registration');

  const generalScheduleRegistrationTemplate = find(collaborations, (col) => col.name === 'General Schedule Registration');
  const isGeneralRegistrationTemplate = () => {
    if (email === 'dev@qcgtech.com' || isDoctor) {
      return false;
    }

    const isScheduleRegistration = generalScheduleRegistrationTemplate?.localId === newPatient.collaborationId;
    return generalRegistrationTemplate?.localId === newPatient.collaborationId || isScheduleRegistration;
  };

  const timezones = GetTimezone();

  const doctorFilterOptions = createFilterOptions({
    matchFrom: 'any'
  });

  const getLocationBlockTime = (blockTimes, doctorEmail) => {
    const blocks = blockTimes.filter((item) => item.doctor === doctorEmail);
    blockTimes.map(({ doctor }) => doctor);
    return blocks.map((a) => a.location);
  };

  const verifyDiagnosis = (name) => {
    if (typeof diagnosisAvailableSlots[name] === 'undefined' || name === '') {
      return false;
    }
    return true;
  };

  const getAllDoctorAndLocationByDiagnosis = () => {
    if (newPatient.diagnosis === null || isEmpty(providerCalendars)) return [];
    const availableSlots = providerCalendars;
    const allStartTimeOfWeek = map(availableSlots, (slot) => (slot.startTimes));
    const list = allStartTimeOfWeek.map((item) => item.map((block) => ({
      doctorEmail: block.doctor,
      location: block.location
    })));
    let data = [];
    list.map((item) => {
      data = data.concat(item);
      return item;
    });
    data = _.uniq(data);
    const result = _.uniqWith(data, _.isEqual);
    return result;
  };

  const [selectedDoctor, setSelectedDoctor] = React.useState(null); // Add this line

  const handleChangeReferredBy = (value) => {
    setSelectedDoctor(value); // Add this line
    if (!value.providerSuffix
      || !value.doctorType
      || !value.phoneNumber
      || !value.faxNumber
      || !value.address) {
      setBackgroundAutoComplete(true);
    } else {
      setBackgroundAutoComplete(false);
    }
    dispatch(changePatientField('referredBy', value.doctorName)); // Change back to doctorName
  };

  const handleChange = (event) => {
    if (event) {
      event.persist();
    }
    const { name } = event.target;
    const value = ['verifyMobile', 'patientConsent', 'confirmed', 'sendWelcomeSMS', 'fax', 'override', 'scheduled'].includes(name) ? event.target.checked : event.target.value;
    if (name === 'dobDate') {
      setDobDate(value);
      const d = newPatient.dateOfBirth ? new Date(newPatient.dateOfBirth) : new Date();
      d.setDate(value);
      dispatch(changePatientField('dateOfBirth', moment(d).format(DefaultDateFormat)));
      return;
    }

    if (name === 'dobMonth') {
      setDobMonth(value);
      const d = newPatient.dateOfBirth ? new Date(newPatient.dateOfBirth) : new Date();
      d.setMonth(value - 1);
      dispatch(changePatientField('dateOfBirth', moment(d).format(DefaultDateFormat)));
      return;
    }

    if (name === 'dobYear') {
      setDobYear(value);
      const d = newPatient.dateOfBirth ? new Date(newPatient.dateOfBirth) : new Date();
      d.setFullYear(value);
      dispatch(changePatientField('dateOfBirth', moment(d).format(DefaultDateFormat)));
      return;
    }

    if (name === 'procedureTime') {
      setHighlightFields((prev) => [
        prev.filter((s) => s !== 'procedureTime')
      ]);
    }

    if (name === 'procedureTimePicker') {
      setHighlightFields((prev) => [
        prev.filter((s) => s !== 'procedureTimePicker')
      ]);
    }

    if (name === 'confirmed') {
      if (value) {
        if (!(newPatient.procedureTime && newPatient.procedureTimePicker)) {
          setHighlightFields((prev) => [
            prev,
            'procedureTime',
            'procedureTimePicker'
          ]);
        }
      }
    }

    if (name === 'mobilePhone') {
      dispatch(changePatientField('mobilePhone', decodePhoneNumber(value)));
      return;
    }

    if (name === 'parseTelehealthTime') {
      dispatch(changePatientField('parseTelehealthTime', value));
      return;
    }
    if (name === 'telehealthDoctorId') {
      dispatch(changePatientField('procedureTime', ''));
      dispatch(changePatientField('parseTelehealthDate', ''));
    }
    // if(name === 'referral') {
    //   setReferralValue(value);
    // }
    // if (name === 'referredBy') {
    //   handleChangeReferredBy(value);
    // }

    // if (name === 'referralRequired') {
    //
    // }
    //
    // if (name === 'referralReceived') {
    //
    // }


    setFormState((prevValues) => ({
      ...prevValues,
      values: {
        ...prevValues.values,
        [name]: value
      },
      touched: {
        ...prevValues.touched,
        [name]: true
      }
    }));

    dispatch(changePatientField(name, value));
  };

  const handleCalendarOpen = (trigger) => {
    setCalendarTrigger(trigger);
  };

  const handleVisitCalendarOpen = (trigger) => {
    setVisitCalendarTrigger(trigger);
  };

  const handleSetUseDefaultTimezone = () => {
    setUseDefaultTimezone(!useDefaultTimezone);
    if (!useDefaultTimezone) {
      dispatch(changePatientField('timezone', fetchedBusiness.timezone));
    }
  };

  const handleCalendarChange = () => {
  };

  const handleCalendarAccept = (date) => {
    setValues((prevValues) => ({
      ...prevValues,
      [calendarTrigger]: date
    }));

    if (calendarTrigger === 'procedureTime') {
      const currentDate = newPatient.procedureTime ? moment(newPatient.procedureTime) : moment();
      currentDate.set('date', date.date());
      currentDate.set('month', date.month());
      currentDate.set('year', date.year());

      dispatch(changePatientField('procedureTime', currentDate));
      return;
    }
    dispatch(changePatientField(calendarTrigger, date));
  };

  //  If visit date and visit time are entered then remove SCHEDULE_MEDICAL_HISTORY
  useEffect(() => {
    if (newPatient.parseTelehealthDate !== undefined  || newPatient.parseTelehealthTime !== undefined) {
      setSendToPatientAction(Object.fromEntries(
        Object.entries(sendToPatientActions).filter(([key, value]) => value.value !== sendToPatientActions.SCHEDULE_MEDICAL_HISTORY.value)
      ));
    }
  }, [newPatient.parseTelehealthDate]);

  useEffect(() => {
    const emails1 = filterDoctorEmail(procedureAvailableSlots, telehealthAvailableSlots);
    const emails2 = filterScheduleDiagnosisDoctorEmail(diagnosisAvailableSlots, emails1);
    dispatch(fetchBasicDoctorInfo([...emails1, ...emails2]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (selectedDate) {
      setShowCalendar(false);
      dispatch(changePatientField('parseTelehealthDate', selectedDate));
      dispatch(changeSelectedDateOfTelehealthCalendar(selectedDate));
    }
  }, [selectedDate]);

  useEffect(() => {
    async function fetchData() {
      try {
        const doctorResponse = await commonService.getDoctor();
        const { data: doctorData } = doctorResponse;
        if (!isEmpty(doctorData)) {
          const updateDoctors = doctorData.map((item) => ({
            ...item,
            label: `${item.firstName ? item.firstName : ''} ${item.lastName ? item.lastName : ''} ${item.providerSuffix ?`, ${item.providerSuffix}` : ''}`.trim()
          }))
          setAllDoctors(updateDoctors);
          // const temp = doctorData.map((doc) => `${doc.firstName} ${doc.lastName}`);
          // setDoctors(temp);
        }
      } catch (e) {
        console.log(e);
      }
    }

    fetchData();
  }, []);
  useEffect(() => {
    if (newPatient.diagnosis !== '' && Array.isArray(providers)) {
      const listDoctorsLocations = getAllDoctorAndLocationByDiagnosis();
      setListDoctorLocation(listDoctorsLocations);
      let doctorEmails = listDoctorsLocations;
      let doctorLocations = listDoctorsLocations;

      if (providerEmailSelected !== '') {
        doctorLocations = doctorLocations.filter((a) => a.doctorEmail === providerEmailSelected);
      }

      doctorEmails = doctorEmails.map((a) => a.doctorEmail);
      doctorLocations = doctorLocations.map((a) => a.location);

      doctorEmails = _.uniq(doctorEmails);
      doctorLocations = _.uniq(doctorLocations);
      let providersValid = providers.filter((doc) => _.includes(doctorEmails, doc.localEmail));

      providersValid = _.sortBy(providersValid, ['lastName']);
      setListProvidersValid(providersValid);
      setListLocationsValid(doctorLocations);
      setListProvidersDisplay(providersValid);
      setListLocationsDisplay(doctorLocations);
    }
  }, [newPatient.diagnosis, providers, providerCalendars, selectedDate, providerEmailSelected, locationSelected]);

  const handleCalendarClose = () => {
    setCalendarTrigger(false);
  };

  const handleVisitCalendarChange = () => {
  };

  const handleVisitCalendarAccept = (date) => {
    setValues((prevValues) => ({
      ...prevValues,
      [visitCalendarTrigger]: date
    }));

    if (visitCalendarTrigger === 'parseTelehealthDate') {
      const currentDate = newPatient.visitTime ? moment(newPatient.visitTime) : moment();
      currentDate.set('date', date.date());
      currentDate.set('month', date.month());
      currentDate.set('year', date.year());

      dispatch(changePatientField('parseTelehealthDate', currentDate));
      return;
    }
    dispatch(changePatientField(visitCalendarTrigger, date));
  };

  const handleVisitCalendarClose = () => {
    setVisitCalendarTrigger(false);
  };

  const handleChangeLocation = (event) => {
    const { value } = event.target;
    setLocationSelected(value);
    setShowCalendar(true);
    const filter = { doctorId: providerSelected, location: value.trim() };
    dispatch(updateFilterProvider(filter));
    dispatch(changePatientField('location', value));
  };

  const handleChangeProvider = (event) => {
    const { value, name } = event.target;
    let locationsSelected = [];
    const selectedItem = providers.find((provider) => provider.localId === value);
    if (value.trim() === '') {
      locationsSelected = [...listLocationsValid];
    } else {
      locationsSelected = listDoctorLocation.filter((item) => item.doctorEmail === selectedItem.localEmail).map((a) => a.location);
    }
    const selectedProviderId = selectedItem !== undefined ? selectedItem.localId : '';
    const doctorEmail = selectedItem !== undefined ? selectedItem.localEmail : '';

    setProviderSelected(selectedProviderId);
    setProviderEmailSelected(doctorEmail);
    setSelectedTime('');
    setLocationSelected('');
    setListLocationsDisplay(locationsSelected);
    const filter = { doctorId: value.trim(), location: '' };
    dispatch(changePatientField(name, value));
    dispatch(updateFilterProvider(filter));
  };
  const removeParam = (key, sourceURL) => {
    let rtn = sourceURL.split('?')[0];
    let param;
    let params_arr = [];
    const queryString = (sourceURL.indexOf('?') !== -1) ? sourceURL.split('?')[1] : '';
    if (queryString !== '') {
      params_arr = queryString.split('&');
      for (let i = params_arr.length - 1; i >= 0; i -= 1) {
        param = params_arr[i].split('=')[0];
        if (param === key) {
          params_arr.splice(i, 1);
        }
      }
      if (params_arr.length) rtn = `${rtn}?${params_arr.join('&')}`;
    }
    return rtn;
  };
  const hasError = (field) => !!(formState.touched[field] && formState.errors[field]);
  const handleCLickShowListPatient = () => {
    const currentUrl = window.location.href;
    const newUrl = removeParam('patient', currentUrl);
    window.location.replace(newUrl);
  };
  const clickListPatient = () => {
    window.location.replace(`/preps/patients/${selectedPrep}`);
  };

  const dayStr = (dayNumber) => {
    if (dayNumber === 0) return DAYS_OF_THE_WEEK[6]; // Sunday
    return DAYS_OF_THE_WEEK[dayNumber - 1];
  };

  const dayNumber = (dayStr) => {
    const index = DAYS_OF_THE_WEEK.findIndex((item) => item === dayStr);
    if (index === 6) return 0; // Sunday
    if (index !== -1) return index + 1;
    return false;
  };

  const getLocationNameById = (id) => {
    const location = officeLocations?.find((item) => item?.localId == id);
    return !isEmpty(location) ? location?.officeName : '';
  };

  const getYesNoText = (appointment, option, isRequired) => {
    let result = '';
    if (!appointment?.data_info) {
      return '';
    }
    // const option = isRequired ? appointment.referralRequired : appointment.referralReceived;
    if (option !== null && appointment.data_info !== null && appointment.data_info !== '') {
      const statusList = JSON.parse(appointment.data_info);
      let key = getReferralReceivedKeyAppointment(option);
      if (isRequired) {
        key = getReferralRequiredKeyAppointment(option);
      }
      if (key === '' || statusList === null) return '';
      const currentStatus = statusList[key];
      if (!currentStatus) {
        return '';
      }
      if (currentStatus.user_update !== '' && currentStatus.update_at !== '') {
        const dateText = moment(currentStatus.update_at).format(
          'MMM Do, YY h:mma'
        );
        result = `${currentStatus.user_update} - ${dateText}`;
      }
    }
    return result;
  };

  // ----------------------useEffect----------------------

  const fetchProviderCalendar = async () => {
    try {
      const options = { diagnosis_id: newPatient.diagnosis };
      const result = await commonService.providerCalendarList(options);
      const workingItems = result?.data?.map((item) => Object.keys(item.value));
      const unionDays = workingItems?.reduce((pre, cur) => _.union(pre, cur), []);
      const allWorkingDays = unionDays?.map((item) => dayNumber(item));

      let allTimeSlots = [];
      const data = allWorkingDays?.map((element) => {
        allTimeSlots = result?.data?.reduce((a, b) => {
          let availableOfDay = b?.value?.[dayStr(element)];
          if (!isEmpty(availableOfDay)) {
            availableOfDay = availableOfDay.map((item) => ({ ...item, doctor: b.keyName, location: getLocationNameById(item.locationId) }));
            return a.concat(availableOfDay);
          }
          return a;
        }, []);
        return {
          dayOfWeek: element,
          startTimes: allTimeSlots
        };
      });
      setProviderCalendars(data || []);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    fetchProviderCalendar();
  }, [newPatient.diagnosis]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await commonService.getAllUnavailableSlot();
      const { data } = response;
      setUnavailableSlots(data);
    };
    fetchData();
  }, [newPatient.diagnosis]);

  useEffect(() => {
    dispatch(fetchBusiness(businessId));

    async function fetchData(id) {
      const response = await commonService.getOfficeLocation(id);
      setOfficeLocations(response.data);
    }

    if (businessId) {
      fetchData(businessId);
    }
  }, [dispatch, businessId]);

  useEffect(() => {
    dispatch(changePatientField('timezone', fetchedBusiness.timezone));
  }, [dispatch, fetchedBusiness]);

  useEffect(() => {
    const errors = validate(formState.values, schema);

    setFormState((prevFormState) => ({
      ...prevFormState,
      isValid: !errors,
      errors: errors || {}
    }));
  }, [formState.values]);

  useEffect(() => {
    dispatch(resetHasServerErrorValue(false));
  }, [dispatch]);

  useEffect(() => {
    if (selectedPrep) {
      dispatch(changePatientField('collaborationId', selectedPrep));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrep]);

  useEffect(() => {
    setDobDate(currentDob ? moment(newPatient.dateOfBirth, DefaultDateFormat).date() : 0);
    setDobMonth(currentDob ? moment(newPatient.dateOfBirth, DefaultDateFormat).month() + 1 : 0);
    setDobYear(currentDob ? moment(newPatient.dateOfBirth, DefaultDateFormat).year() : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPatient.dateOfBirth]);

  useEffect(() => {
    dispatch(getProviders());
  }, []);

  return (
    <div
      className={clsx(classes.root, className)}
    >
      {!hasServerError ? null : (
        <Alert
          className={classes.alert}
          variant={serverErrorType}
          message={serverErrorMessage}
        />
      )}
      <Grid
        container
        spacing={3}
      >
        <Grid
          item
          md={6}
          xs={6}
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            marginBottom: '1rem'
          }}
        >
          <TextField
            fullWidth
            label='Reason for Visit'
            name='diagnosis'
            value={newPatient.diagnosis}
            onChange={handleChange}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            SelectProps={{ native: true }}
            inputProps={newPatient.diagnosis}
            select
          >
            <option key={0} value='' disabled />
            <option id="anal_fissure" value="anal_fissure">Anal Fissure</option>
            <option id="anal_fistula" value="anal_fistula">Anal Fistula</option>
            <option id="anal_pain" value="anal_pain">Anal Pain</option>
            <option id="anal_abscess" value="anal_abscess">Anal Abscess</option>
            <option id="colorectal_cancer" value="colorectal_cancer">Colorectal Cancer</option>
            <option id="colon_polyps" value="colon_polyps">Colon Polyps</option>
            <option id="colostomy_reversal" value="colostomy_reversal">Colostomy Reversal</option>
            <option id="colonoscopy" value="colonoscopy">Colonoscopy</option>
            <option id="constipation" value="constipation">Constipation</option>
            <option id="crohns_disease" value="crohns_disease">Crohn's Disease</option>
            <option id="diverticulitis" value="diverticulitis">Diverticulitis</option>
            <option id="endometriosis_of_the_bowel" value="endometriosis_of_the_bowel">
              Endometriosis of the Bowel
            </option>
            <option id="fecal_incontinence" value="fecal_incontinence">Fecal Incontinence</option>
            <option id="hemorrhoids" value="hemorrhoids">Hemorrhoids</option>
            <option id="pilonidal_cyst" value="pilonidal_cyst">Pilonidal Cyst</option>
            <option id="rectal_bleeding" value="rectal_bleeding">Rectal Bleeding</option>
            <option id="ulcerative_colitis" value="ulcerative_colitis">Ulcerative Colitis</option>
            <option id="other" value="other">Other</option>
          </TextField>
        </Grid>
        
          {/* <Grid
            item
            md={12}
            xs={12}
            style={{
              marginTop: '10px'
            }}
          >
            <TextField
              fullWidth
              label='Template Name'
              name='collaborationId'
              onChange={handleChange}
              select
              SelectProps={{ native: true }}
              value={newPatient.collaborationId}
              variant='outlined'
              InputLabelProps={{ shrink: true }}
            >
              <option disabled />
              {collaborations.map((collaboration) => (
                <option
                  key={collaboration.localId}
                  value={collaboration.localId}
                >
                  {collaboration.name}
                </option>
              ))}
            </TextField>
          </Grid> */}
        
        <Grid
          item
          md={12}
          xs={12}
          style={{
            marginBottom: '1rem'
          }}
        >
          <h4>Patient Info</h4>
        </Grid>
      </Grid>
      <Grid
        container
        spacing={3}
      >
        <Grid
          item
          md={6}
          xs={12}
        >
          <TextField
            fullWidth
            error={hasError('firstName')}
            helperText={hasError('firstName') ? formState.errors.firstName[0] : null}
            label='First Name'
            name='firstName'
            onChange={handleChange}
            value={newPatient.firstName}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            style={{
              fontWeight: 'bold',
              color: 'red'
            }}
          />
        </Grid>
        <Grid
          item
          md={6}
          xs={12}
        >
          <TextField
            fullWidth
            error={hasError('lastName')}
            helperText={hasError('lastName') ? formState.errors.lastName[0] : null}
            label='Last Name'
            name='lastName'
            onChange={handleChange}
            value={newPatient.lastName}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            style={{
              fontWeight: 'bold',
              color: 'red'
            }}
          />
        </Grid>
        <Grid
          item
          md={6}
          xs={12}
        >

          <TextField
            error={hasError('mobilePhone')}
            fullWidth
            helperText={hasError('mobilePhone') ? formState.errors.mobilePhone[0] : null}
            label='Mobile Phone'
            name='mobilePhone'
            onChange={handleChange}
            value={encodePhoneNumber(newPatient.mobilePhone)}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            style={{
              fontWeight: 'bold',
              color: 'red'
            }}
          />
        </Grid>
        <Grid
          item
          md={6}
          xs={12}
        >
          <TextField
            fullWidth
            label='Email Address'
            name='email'
            onChange={handleChange}
            value={newPatient.email === DEFAULT_EMAIL ? '' : newPatient.email}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            style={{
              fontWeight: 'bold',
              color: 'red'
            }}
          />
        </Grid>
        {/* <Grid
          item
          md={6}
          xs={12}
          className={classNames({
            hide: isGeneralRegistrationTemplate()
          })}
        >
          <TextField
            error={hasError('streetAddress')}
            fullWidth
            helperText={hasError('streetAddress') ? formState.errors.streetAddress[0] : null}
            label='Street address'
            name='streetAddress'
            onChange={handleChange}
            value={newPatient.streetAddress}
            variant='outlined'
          />
        </Grid> */}
        {/* <Grid
          item
          md={6}
          xs={12}
          className={classNames({
            hide: isGeneralRegistrationTemplate()
          })}
        >
          <TextField
            error={hasError('zipCode')}
            fullWidth
            helperText={hasError('zipCode') ? formState.errors.zipCode[0] : null}
            label='Zip code'
            name='zipCode'
            onChange={handleChange}
            value={newPatient.zipCode}
            variant='outlined'
          />
        </Grid> */}
      </Grid>
      <Grid
        container
        spacing={3}
      >
        <Grid
          item
          md={2}
          xs={6}
        >
          <TextField
            fullWidth
            label='DOB Month'
            name='dobMonth'
            value={dobMonth}
            onChange={handleChange}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            SelectProps={{ native: true }}
            select
          >
            <option key={0} value={0} disabled />
            {Object.keys(months).map((key) => <option key={months[key]} value={months[key]}>{key}</option>)}
          </TextField>
        </Grid>
        <Grid
          item
          md={2}
          xs={2}
        >
          <TextField
            fullWidth
            label='DOB Day'
            name='dobDate'
            value={dobDate}
            onChange={handleChange}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            SelectProps={{ native: true }}
            select
          >
            <option key={0} value={0} disabled />
            {Array.from({ length: daysInMonth(dobMonth, dobYear) }, (_, i) => i + 1).map((day) => (
              <option
                key={day}
                value={day}
              >
                {day}
              </option>
            ))}
          </TextField>
        </Grid>
        <Grid
          item
          md={2}
          xs={4}
        >
          <TextField
            fullWidth
            label='DOB Year'
            name='dobYear'
            value={dobYear}
            onChange={handleChange}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            SelectProps={{ native: true }}
            select
          >
            {Array.from(
              { length: (new Date()).getFullYear() - 1800 },
              (_, i) => (new Date()).getFullYear() - i
            ).map((i) => (<option key={i} value={i}>{i}</option>))}
          </TextField>
        </Grid>
      </Grid>
      <Divider
        style={{

          alignItems: 'center',
          background: '#e0deff',
          marginTop: '1rem'
        }}
      />
      <Grid
        container
        spacing={3}
      >
        <Grid
          item
          md={4}
          xs={12}
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            marginBottom: '1rem',
            marginTop: '1rem'
          }}
        >
          <TextField
            fullWidth
            label='How was it referred?'
            name='referral'
            value={patientId ? (referralValue || newPatient.referral ) : referralValue}
            onChange={handleChange}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            SelectProps={{ native: true }}
            inputProps={newPatient.referral}
            defaultValue={newPatient.referral}
            select
          >
            <option key={0} value='' disabled />
            <option id="PCP" value="PCP">Healthcare Provider</option>
            {/* <option id="FAX" value="FAX">Provider Fax</option> */}
            <option id="DE" value="DE">Directly from Email</option>
            {/* <option id="GAS" value="GAS">Gastroenterologist</option>
            <option id="GYN" value="GYN">OB/Gyn</option>
            <option id="URO" value="URO">Urologist</option>
            <option id="CAR" value="CAR">Cardiologist</option>
            <option id="END" value="END">Endocrinologist</option>
            <option id="NEU" value="NEU">Neurologist</option>
            <option id="ONC" value="ONC">Oncologist</option>
            <option id="PUL" value="PUL">Pulmonologist</option>
            <option id="RHE" value="RHE">Rheumatologist </option>
            <option id="ID" value="ID">Infectious Disease</option> */}
            <option id="WOM" value="WOM">Word of Mouth</option>
            <option id="WEB" value="WEB">HoustonColon website</option>
            <option id="REV" value="REV">Online Reviews</option>
            <option id="YT" value="YT">YouTube</option>
            <option id="SM" value="SM">Social Media</option>
            <option id="SEA" value="SEA">Internet Search</option>
            <option id="INS" value="INS">Insurance</option>
          </TextField>
        </Grid>
        {/* {(referralValue === 'PCP' || newPatient.referral === 'PCP'  && referralValue === 'FAX' || newPatient.referral === 'FAX') &&  */}
        <Grid
          item
          md={4}
          xs={12}
          style={{
            alignItems: 'center',
            marginBottom: '1rem',
            marginTop: '1rem'
          }}
        >
          <Autocomplete
            filterOptions={doctorFilterOptions}
            id='medicine-input'
            freeSolo
            options={allDoctors}
            getOptionLabel={(option) => option.label}
            style={{ width: '100%', backgroundColor: backgroundAutoComplete ? '#ffc7c6' : '#ffffff'}}
            onInputChange={(event, newInputValue) => {
              onChangeReferral(newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label='Referred by Provider'
                name='referredBy'
                variant='outlined'
                InputLabelProps={{ shrink: true }}
              />
            )}
            value={selectedDoctor} // Use selectedDoctor here
            onChange={(event, newValue) => handleChangeReferredBy(newValue)}
            variant='outlined'
            defaultValue={newPatient.selectedDoctor}
          />

        </Grid>
        <Grid
          item
          md={2}
          xs={6}
          style={{
            alignItems: 'center',
            marginBottom: '1rem',
            marginTop: '1rem',
          }}
        >
          {(!patientId || (newPatient?.appointment && patientId)) && <TextField
            select
            InputLabelProps={{ shrink: true }}
            inputProps={newPatient?.referralRequired}
            fullWidth
            label={'Authorization Required'}
            variant="outlined"
            name="referralRequired"
            defaultValue={newPatient?.referralRequired}
            onChange={(e) => handleChange(e)}
          >
            {Object.keys(answerList).map((key) => (
              <MenuItem key={key} value={answerList[key]}>
                <p>{upperCase(key)}</p>
                <p style={{ width: '100%', fontSize: '8px', paddingLeft: '10px' }}>
                  {getYesNoText(newPatient.appointment, key, true)}
                </p>
              </MenuItem>
            ))}
          </TextField>}
        </Grid>

        <Grid
          item
          md={2}
          xs={6}
          style={{
            alignItems: 'center',
            marginBottom: '1rem',
            marginTop: '1rem',
          }}
        >
          {(!patientId || (newPatient?.appointment && patientId)) && <TextField
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={newPatient?.referralReceived}
            disabled={!newPatient?.referralRequired}
            label={'Authorization Recevied'}
            variant="outlined"
            name="referralReceived"
            style={{ maxHeight: '54px' }}
            select
            defaultValue={newPatient?.referralReceived}
            onChange={(e) => handleChange(e)}
          >
            {Object.keys(answerList).map((key) => (
              <MenuItem key={key} value={answerList[key]}>
                <p>{upperCase(key)}</p>
                <p style={{ width: '100%', fontSize: '8px', paddingLeft: '10px' }}>
                  {getYesNoText(newPatient.appointment, key, false)}
                </p>
              </MenuItem>
            ))}
          </TextField>}
        </Grid>

        {/* <Grid
          item
          md={6}
          xs={6}
          style={{

            alignItems: 'center',
            marginBottom: '1rem',
            marginTop: '1rem'
          }}
          className={classNames({
            hide: true
          })}
        >

          <TextField
            name='visitType'
            label='Visit Type'
            onChange={handleChange}
            select
            SelectProps={{ native: true }}
            value={newPatient.visitType}
            variant='outlined'
            style={{
              flexGrow: '1',
              // marginLeft: '1rem'

            }}
          >
            <option disabled />
            <option key={0} value="0">Office</option>
            <option key={1} value="1">Telehealth</option>
          </TextField>
          {newPatient.visitType === '0' && (
            <TextField
              name='visitOfficeId'
              onChange={handleChange}
              select
              SelectProps={{ native: true }}
              value={newPatient.visitOfficeId}
              variant='outlined'
              style={{
                flexGrow: '1',
                marginLeft: '1rem'
              }}
            >
              <option disabled />
              {officeLocations?.map((office) => (
                <option
                  key={office.localId}
                  value={office.localId}
                >
                  {office.officeName}
                </option>
              ))}
            </TextField>
          )}
        </Grid> */}

      </Grid>
      {/* <Divider
        style={{
          alignItems: 'center',
          background: '#e0deff',
          marginBottom: '1rem'
        }}
      /> */}
      {/* {(from !== 'surgery' ) && ( */}
        <Grid
            item
            md={12}
            xs={12}
            style={{
              marginBottom: '1rem'
            }}
            >
            <h4>Office Visit</h4>
        </Grid>
      {/* )} */}
      {(from !== 'surgery' ) && (
        <Grid
          container
          spacing={3}
        >

          {/* <Grid
            item
            md={6}
            xs={6}
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              marginBottom: '1rem'
            }}
          >

            <TextField
              fullWidth
              label='Reason for Visit'
              name='diagnosis'
              value={newPatient.diagnosis}
              onChange={handleChange}
              variant='outlined'
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              inputProps={newPatient.diagnosis}
              select
            >
              <option key={0} value='' disabled />
              <option id="anal_fissure" value="anal_fissure">Anal Fissure</option>
              <option id="anal_fistula" value="anal_fistula">Anal Fistula</option>
              <option id="anal_pain" value="anal_pain">Anal Pain</option>
              <option id="anal_abscess" value="anal_abscess">Anal Abscess</option>
              <option id="colorectal_cancer" value="colorectal_cancer">Colorectal Cancer</option>
              <option id="colon_polyps" value="colon_polyps">Colon Polyps</option>
              <option id="colostomy_reversal" value="colostomy_reversal">Colostomy Reversal</option>
              <option id="colonoscopy" value="colonoscopy">Colonoscopy</option>
              <option id="constipation" value="constipation">Constipation</option>
              <option id="crohns_disease" value="crohns_disease">Crohn's Disease</option>
              <option id="diverticulitis" value="diverticulitis">Diverticulitis</option>
              <option id="endometriosis_of_the_bowel" value="endometriosis_of_the_bowel">
                Endometriosis of the Bowel
              </option>
              <option id="fecal_incontinence" value="fecal_incontinence">Fecal Incontinence</option>
              <option id="hemorrhoids" value="hemorrhoids">Hemorrhoids</option>
              <option id="pilonidal_cyst" value="pilonidal_cyst">Pilonidal Cyst</option>
              <option id="rectal_bleeding" value="rectal_bleeding">Rectal Bleeding</option>
              <option id="ulcerative_colitis" value="ulcerative_colitis">Ulcerative Colitis</option>
              <option id="other" value="other">Other</option>
            </TextField>
          </Grid> */}

          <Grid
            item
            lg={4}
            md={3}
            xs={9}
          >
            <TextField
              fullWidth
              label='Provider'
              name='telehealthDoctorId'
              select
              SelectProps={{ native: true }}
              value={newPatient.telehealthDoctorId}
              variant='outlined'
              onChange={handleChangeProvider}
              InputLabelProps={{ shrink: true }}
              style={{
                // marginBottom: '1rem'
              }}
            >
              <option disabled />
              <option value=" ">Any Available Provider</option>
              {(newPatient.override ? providers : listProvidersDisplay)?.map((option) => (
                <option key={option.localId} value={option.localId}>
                  {' '}
                  {option.firstName}
                  {' '}
                  {option.lastName}
                </option>
              ))}
            </TextField>

          </Grid>

          <Grid
            item
            lg={1}
            md={2}
            xs={2}
            style={{
              alignItems: 'center'
            }}
          >
            <FormControlLabel
              control={(
                <Checkbox
                  checked={newPatient?.override || false}
                  onChange={handleChange}
                  name='override'
                  style={{ color: 'grey' }}
                />
                )}
              label={(
                <p
                  style={{ fontFamily: '"Helvetica Neue", Arial, Helvetica, Geneva, sans-serif', width: 80 }}
                >
                  Override
                </p>
                )}
              className={classes.immediateBox}
            />

          </Grid>
          <Grid
            item
            md={3}
            xs={12}
          >
            <TextField
              fullWidth
              label='Location'
              name='location'
              select
              value={newPatient.location}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              variant='outlined'
              onChange={handleChangeLocation}
            >
              <option disabled />
              <option value=" ">Any Available Location</option>
              {(newPatient.override ? officeLocations?.map((item) => item.officeName) : listLocationsDisplay)?.map((option) => (
                <option key={option} value={option}>
                  {' '}
                  {option}
                  {' '}
                </option>
              ))}

            </TextField>
          </Grid>

          <Grid
            item
            md={2}
            xs={12}
          >
            <TextField
              fullWidth
              type='text'
              error={hasError('parseTelehealthDate')}
              helperText={hasError('parseTelehealthDate') ? formState.errors.parseTelehealthDate[0] : null}
              label='Visit Date'
              readonly
              onFocus={() => setShowCalendarModal(true)}
              onClick={() => setShowCalendarModal(true)}
              name='parseTelehealthDate'
              value={newPatient.parseTelehealthDate ? moment(newPatient.parseTelehealthDate).format(DefaultDateFormat) : ''}
              variant='outlined'
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid
            item
            md={2}
            xs={12}
          >
            <TextField
              fullWidth
              error={hasError('parseTelehealthTime')}
              helperText={
                hasError('parseTelehealthTime') ? formState.errors.parseTelehealthTime[0] : null
              }
              label='Visit Time'
              name='parseTelehealthTime'
              disabled
              onChange={handleChange}
              onFocus={() => setShowCalendarModal(true)}
              onClick={() => setShowCalendarModal(true)}
              type='time'
              value={newPatient.parseTelehealthTime}
              variant='outlined'
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid
            item
            lg={1}
            md={2}
            xs={2}
            style={{
              alignItems: 'center'
            }}
          >
            <FormControlLabel
              control={(
                <Checkbox
                  checked={newPatient?.scheduled || false}
                  onChange={handleChange}
                  name='scheduled'
                  style={{ color: 'grey' }}
                />
                )}
              label={(
                <p
                  style={{ fontFamily: '"Helvetica Neue", Arial, Helvetica, Geneva, sans-serif', width: 120 }}
                >
                  Scheduled in ECW
                </p>
                )}
              className={classes.immediateBox}
            />

          </Grid>

        </Grid>
      )}
      {/* <Grid
        container
      >

        {(from === 'surgery' || (isAdministrators(userType)) || (isScheduler(userType))) && <Grid
          item
          md={12}
          xs={12}
          style={{
            marginBottom: '1rem',
            marginTop: '1rem'
          }}
          className={classNames({
            hide: isGeneralRegistrationTemplate()
          })}
        >

            <h4>Procedure</h4>

        </Grid>}
      </Grid> */}
      {/* {((isAdministrators(userType))
        || (isScheduler(userType)) 
        || (isDoctorProvider(userType))) 
      && <Grid
        container
        spacing={3}
        className={classNames({
          hide: isGeneralRegistrationTemplate()
        })}
      >
        <Grid
          item
          md={12}
          xs={12}
        >

            <TextField
              fullWidth
              label='Facility'
              name='businessLocationId'
              onChange={handleChange}
              select
              SelectProps={{ native: true }}
              value={newPatient.businessLocationId}
              variant='outlined'
              InputLabelProps={{ shrink: true }}
            >
              <option disabled />
              {facilities.map((facility) => (
                <option
                  key={facility.localId}
                  value={facility.localId}
                >
                  {facility.name}
                </option>
              ))}
            </TextField>

        </Grid>
        <Grid
          item
          md={3}
          xs={12}
        >
          <TextField
            fullWidth
            error={hasError('procedureDate')}
            helperText={hasError('procedureDate') ? formState.errors.procedureDate[0] : null}
            label='Procedure Date'
            name='procedureTime'
            onClick={() => handleCalendarOpen('procedureTime')}
            value={newPatient.procedureTime ? moment(newPatient.procedureTime).format(DefaultDateFormat) : null}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            className={(highlightFields.includes('procedureTime') && !newPatient.procedureTime) ? classes.highlightField : null}
          />
        </Grid>

        <Grid
          item
          md={3}
          xs={12}
        >
          <TextField
            fullWidth
            error={hasError('procedureTime')}
            helperText={hasError('procedureTimePicker') ? formState.errors.procedureTime[0] : null}
            label='Procedure Time'
            name='procedureTimePicker'
            type='time'
            onChange={handleChange}
            value={newPatient.procedureTimePicker}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            className={(highlightFields.includes('procedureTimePicker') && !newPatient.procedureTimePicker) ? classes.highlightField : null}
          />
        </Grid>
        <Grid
          item
          md={3}
          xs={12}
        >
          <TextField
            fullWidth
            label='Procedure Provider'
            name='procedureDoctorId'
            onChange={handleChange}
            select
            SelectProps={{ native: true }}
            value={newPatient.procedureDoctorId}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
          >
            <option disabled />
            {providers?.map((provider) => (
              <option
                key={provider.localId}
                value={provider.localId}
              >
                {provider.firstName}
                {' '}
                {provider.lastName}
              </option>
            ))}
          </TextField>
        </Grid>
        <Grid
          item
          md={3}
          xs={12}
        >
          <TextField
            fullWidth
            label='Procedure Type'
            name='procedureType'
            onChange={handleChange}
            select
            SelectProps={{ native: true }}
            value={newPatient.procedureType}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
          >
            <option />
            {Object.keys(procedureTypes)?.map((key) => (
              <option
                key={key}
                value={key}
              >
                {procedureTypes[key]}
              </option>
            ))}
          </TextField>
        </Grid>
      </Grid>} */}

      <Grid
        container
        spacing={3}
        style={{ marginTop: '3rem' }}
      />
      <Grid
        item
        md={12}
        xs={12}
        style={{
          display: 'flex',
          justifyContent: 'flex-start'
        }}
        // className={classNames({
        //   hide: isGeneralRegistrationTemplate()
        // })}
      >
        {/* <Grid
          item
          md={6}
          spacing={6}
          xs={12}
        >
          <TextField
            label='Send to patient'
            name='sendToPatientAction'
            value={newPatient.sendToPatientAction}
            onChange={handleChange}
            variant='outlined'
            InputLabelProps={{ shrink: true }}
            SelectProps={{ native: true }}
            select
            fullWidth
          >
            <option key={0} value={0}>-- --</option>
            {Object.keys(sendToPatientAction).map((key) => (
              <option
                key={sendToPatientAction[key].value}
                value={sendToPatientAction[key].value}
              >
                {sendToPatientAction[key].text}
              </option>
            ))}
          </TextField>
        </Grid> */}
      </Grid>

      <Grid
        container
        spacing={3}
        style={{
          display: 'none'
        }}
      >
        <Grid
          item
          md={6}
          xs={12}
        >
          <Typography variant='h6'>Send Welcome SMS</Typography>
          <Typography variant='body2'>
            Send a welcome introduction text message
          </Typography>
          <Switch
            disabled={!isEmpty(newPatient.localId) && newPatient.sendWelcomeSMS}
            checked={newPatient.sendWelcomeSMS}
            color='secondary'
            edge='start'
            name='sendWelcomeSMS'
            onChange={handleChange}
          />
        </Grid>
        <Grid
          item
          md={6}
          xs={12}
        >
          <Typography variant='h6'>Confirmed patient registration</Typography>
          <Typography variant='body2'>
            Send SMS and Email confirming appointment
          </Typography>
          <Switch
            checked={newPatient.confirmed}
            color='secondary'
            edge='start'
            name='confirmed'
            onChange={handleChange}
          />
        </Grid>
        {/* <Grid */}
        {/*  item */}
        {/*  md={6} */}
        {/*  xs={12} */}
        {/* > */}
        {/*  <Typography variant='h6'>Verify Mobile Phone</Typography> */}
        {/*  <Typography variant='body2'> */}
        {/*    { */}
        {/*      'Enabling this will automatically send the partient an sms' */}
        {/*      + ' text verification code to verify their phone.' */}
        {/*    } */}
        {/*  </Typography> */}
        {/*  <Switch */}
        {/*    checked={newPatient.verifyMobile} */}
        {/*    color='secondary' */}
        {/*    edge='start' */}
        {/*    name='verifyMobile' */}
        {/*    onChange={handleChange} */}
        {/*  /> */}
        {/* </Grid> */}
        <Grid
          item
          md={6}
          xs={12}
        >
          <Typography variant='h6'>Patient Consent</Typography>
          <Typography variant='body2'>
            {'Consent to receive emails and text messages'
              + ' has been granted by this patient.'}
          </Typography>
          <Switch
            checked={newPatient.patientConsent}
            color='secondary'
            edge='start'
            name='patientConsent'
            onChange={handleChange}
          />
        </Grid>
        <Grid
          item
          md={6}
          xs={12}
        >
          <Typography variant='h6'>{`Timezone: ${fetchedBusiness.timezone}`}</Typography>
          <Typography variant='body2'>
            Force facility timezone regardless of patient location
          </Typography>
          <Switch
            checked={useDefaultTimezone}
            color='secondary'
            edge='start'
            name='useDefaultTimezone'
            onChange={handleSetUseDefaultTimezone}
          />
          {!useDefaultTimezone && (
            <Grid
              container
              style={{
                marginTop: '1rem'
              }}
            >
              <Grid
                item
                md={12}
                xs={12}
              >
                <TextField
                  fullWidth
                  label='Select another timezone'
                  name='timezone'
                  onChange={handleChange}
                  select
                  SelectProps={{ native: true }}
                  variant='outlined'
                  value={newPatient.timezone ?? fetchedBusiness.timezone}
                >
                  <option disabled />
                  {timezones?.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          )}
        </Grid>
      </Grid>
      <DatePicker
        onAccept={handleCalendarAccept}
        onChange={handleCalendarChange}
        onClose={handleCalendarClose}
        open={calendarOpen}
        style={{ display: 'none' }} // Hide the input element
        value={calendarValue}
        variant='dialog'
      />
      <DatePicker
        onAccept={handleVisitCalendarAccept}
        onChange={handleVisitCalendarChange}
        onClose={handleVisitCalendarClose}
        open={visitCalendarOpen}
        style={{ display: 'none' }} // Hide the input element
        value={visitCalendarValue}
        variant='dialog'
      />
      <Modal
        open={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Grid style={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          backgroundColor: 'white',
          margin: '2rem 10rem',
          padding: '2rem',
          borderRadius: '1rem'
        }}
        >

          <Grid
            container
            spacing={2}
            style={{
              display: 'flex',
              justifyContent: 'flex-start'
            }}
          >
            <Grid
              container
              xs={6}
              style={{ padding: '2rem' }}
            >
              <Grid
                item
                xs={12}
                style={{
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                {newPatient.diagnosis !== '' && verifyDiagnosis(newPatient.diagnosis) && !isEmpty(providerCalendars)
                  && (
                  <SimpleScheduleDiagnosisPatientCalendar
                    diagnosisName={newPatient.diagnosis}
                    providerEmail={providerEmailSelected}
                    providerLocation={locationSelected}
                    providerCalendars={providerCalendars}
                    unavailableSlots={unavailableSlots}
                    isOverride={newPatient.override}
                  />
                  )}
              </Grid>
            </Grid>
            <Grid
              container
              xs={6}
              style={{ padding: '2rem' }}
            >

              <Grid
                item
                xs={12}
                style={{
                  overflow: 'auto',
                  maxHeight: '300px'
                }}
              >
                {newPatient.diagnosis !== '' && verifyDiagnosis(newPatient.diagnosis) && !isEmpty(providerCalendars)
                  && (
                  <ScheduleDiagnosisListAvailableSlot
                    diagnosisName={newPatient.diagnosis}
                    providerCalendars={providerCalendars}
                    isOverride={newPatient.override}
                  />
                  )}
              </Grid>
            </Grid>
          </Grid>

          <Button
            color='default'
            onClick={() => setShowCalendarModal(false)}
            variant='contained'
            style={{
              width: '5rem',
              marginTop: '3rem'
            }}
          >
            Ok
          </Button>
        </Grid>

      </Modal>
    </div>
  );
}

CreateNewPatientForm.propTypes = {
  className: PropTypes.string
};

export default CreateNewPatientForm;
