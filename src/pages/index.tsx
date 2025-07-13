// Mapbox library and styles
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// Next.js type definitions
import type { GetServerSidePropsContext, NextPage } from "next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RiFocus3Line } from "react-icons/ri";
// Toast notifications provider
import { ToastProvider } from "react-toast-notifications";
// Map event handling tool
import addMapEvents from "../utils/map/addMapEvents";
import Head from "next/head";
import { trpc } from "../utils/trpc";
// Browser environment variables
import { browserEnv } from "../utils/env/browser";
import Header, { HeaderOptions } from "../components/Header";
// NextAuth session retrieval function
import { getSession } from "next-auth/react";
import Spinner from "../components/Spinner";
import { UserContext } from "../utils/userContext";
// lodash library - utility functions
import _, { debounce } from "lodash";
import { SidebarPage } from "../components/Sidebar/Sidebar";
// type definitions
import {
  CarpoolAddress,
  CarpoolFeature,
  EnhancedPublicUser,
  FiltersState,
  GeoJsonUsers,
  PublicUser,
  Request,
} from "../utils/types";
// Prisma generated types
import { Role, User } from "@prisma/client";
// route viewing related tools
import { useGetDirections, viewRoute } from "../utils/map/viewRoute";
// map connect portal component
import { MapConnectPortal } from "../components/MapConnectPortal";
// search hook
import useSearch from "../utils/search";
// map and address related components
import AddressCombobox from "../components/Map/AddressCombobox";
import updateUserLocation from "../utils/map/updateUserLocation"; 
import { MapLegend } from "../components/MapLegend";
// image and icon components
import Image from "next/image";
import BlueSquare from "../../public/user-dest.png";
import BlueCircle from "../../public/blue-circle.png";
// components that changes st
import VisibilityToggle from "../components/Map/VisibilityToggle";
import updateCompanyLocation from "../utils/map/updateCompanyLocation";
// message panel component
import MessagePanel from "../components/Messages/MessagePanel";
import InactiveBlocker from "../components/Map/InactiveBlocker";
// GeoJSON user update tool
import updateGeoJsonUsers from "../utils/map/updateGeoJsonUsers";

// set mapbox access token, is this the global variable that is used to access the mapbox api?
mapboxgl.accessToken = browserEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

/**
 * Server side property retrieval function
 * Mainly Check user authentication status and onboarding completion status?
 */
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession(context);

  // 如果用户未登录，重定向到登录页面
  if (!session?.user) {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: false,
      },
    };
  }
  // 如果用户未完成引导，重定向到设置页面
  if (!session.user.isOnboarded) {
    return {
      redirect: {
        destination: "/profile/setup",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}

/**
 * Home page component - the main interface of this app
 * Contains map, user list, filters, etc.
 */
const Home: NextPage<any> = () => {
  // initial filters state, this is the default filters that will be used when the user first loads the page, filters what user sees on the map
  const initialFilters: FiltersState = {
    days: 0,
    flexDays: 1,
    startDistance: 20,
    endDistance: 20,
    daysWorking: "",
    startTime: 4,
    endTime: 4,
    startDate: new Date(Date.now()),
    endDate: new Date(Date.now()),
    dateOverlap: 0,
    favorites: false,
    messaged: false,
  };
  
  // temporary other user state, this is used to store the user that is being viewed, it is used to update the company location on the map
  const [tempOtherUser, setTempOtherUser] = useState<PublicUser | null>(null);
  const [tempOtherUserMarkerActive, setTempOtherUserMarkerActive] =
    useState(false);
  // default filters state, this is the default filters that will be used when the user first loads the page, filters what user sees on the map
  const [defaultFilters] = useState<FiltersState>(initialFilters);
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  // sort method
  const [sort, setSort] = useState<string>("any");
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  // other user state, this is used to store the user that is being viewed, it is used to update the company location on the map
  const [otherUser, setOtherUser] = useState<PublicUser | null>(null);
  // map initialization state
  const isMapInitialized = useRef(false);
  // map state if loaded
  const [mapStateLoaded, setMapStateLoaded] = useState(false);
  
  // debounce effect - update filters after 300ms, Maybe is used to prevent the map from updating too often?
  useEffect(() => {
    const handler = debounce(() => {
      setDebouncedFilters(filters);
    }, 300);

    handler();

    return () => {
      handler.cancel();
    };
  }, [filters]);

  // get geojson users data
  const { data: geoJsonUsers } =
    trpc.mapbox.geoJsonUserList.useQuery(debouncedFilters);

  // get current user information, the one that is logged in
  const { data: user = null } = trpc.user.me.useQuery();
  // get recommendations list of users that are recommended to the current user
  const { data: recommendations = [] } = trpc.user.recommendations.me.useQuery(
    {
      sort: sort,
      filters: filters,
    },
    { refetchOnMount: true }
  );
  // get favorites list of users 
  const { data: favorites = [] } = trpc.user.favorites.me.useQuery(undefined, {
    refetchOnMount: true,
  });
  // get requests data
  const requestsQuery = trpc.user.requests.me.useQuery(undefined, {
    refetchOnMount: "always",
  });
  const { data: requests = { sent: [], received: [] } } = requestsQuery;
  // tRPC utility function, related to request cache?
  const utils = trpc.useContext();
  
  // handle user selection
  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    if (userId !== "") {
      setOtherUser(null);
    }
  };
  
  // map state
  const [mapState, setMapState] = useState<mapboxgl.Map>();
  // sidebar type
  const [sidebarType, setSidebarType] = useState<HeaderOptions>("explore");
  // popup users list
  const [popupUsers, setPopupUsers] = useState<PublicUser[] | null>(null);
  // map container reference, the div that contains the map?
  const mapContainerRef = useRef(null);
  // route points array, Maybe array of points to draw the route?
  const [points, setPoints] = useState<[number, number][]>([]);
  // company address suggestions list, a list of suggestions for the company address?
  const [companyAddressSuggestions, setCompanyAddressSuggestions] = useState<
    CarpoolFeature[]
  >([]);
  // start address suggestions list
  const [startAddressSuggestions, setStartAddressSuggestions] = useState<
    CarpoolFeature[]
  >([]);

  // selected company address,center:[0,0] here means the center of the map?
  const [companyAddressSelected, setCompanyAddressSelected] =
    useState<CarpoolAddress>({
      place_name: "",
      center: [0, 0],
    });
  // selected start address
  const [startAddressSelected, setStartAddressSelected] =
    useState<CarpoolAddress>({
      place_name: "",
      center: [0, 0],
    });

  // company address input
  const [companyAddress, setCompanyAddress] = useState("");
  // debounce update company address, useMemo is used to memoize the function, so that it is not recreated on every render
  const updateCompanyAddress = useMemo(
    () => debounce(setCompanyAddress, 250),
    []
  );

  // start address input
  const [startingAddress, setStartingAddress] = useState("");
  // debounce update start address
  const updateStartingAddress = useMemo(
    () => debounce(setStartingAddress, 250),
    []
  );

  // extend public user information, add favorite and request status
  const extendPublicUser = useCallback(
    (user: PublicUser): EnhancedPublicUser => {
      const incomingReq: Request | undefined = requests.received.find(
        (req) => req.fromUserId === user.id
      );
      const outgoingReq: Request | undefined = requests.sent.find(
        (req) => req.toUserId === user.id
      );

      return {
        ...user,
        isFavorited: favorites.some((favs) => favs.id === user.id),
        incomingRequest: incomingReq,
        outgoingRequest: outgoingReq,
      };
    },
    [favorites, requests]
  );

  // handle message sent, invalidate request cache and refetch requests
  const handleMessageSent = (selectedUserId: string) => {
    utils.user.requests.me.invalidate();
    requestsQuery.refetch();
    setSelectedUserId(selectedUserId);
  };
  // selected user id
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // selected user information
  const selectedUser: EnhancedPublicUser | null = useMemo(() => {
    if (!selectedUserId || !requests) return null;
    const allRequests = [...requests.sent, ...requests.received];
    for (const request of allRequests) {
      const user: any =
        request.fromUser.id === selectedUserId
          ? request.fromUser
          : request.toUser;
      if (user.id === selectedUserId)
        return extendPublicUser(user) as EnhancedPublicUser;
    }
    return null;
  }, [selectedUserId, requests, extendPublicUser]);

  // handle route view click event, maybe trigger when user clicks on a user on the map?
  const onViewRouteClick = useCallback(
    (user: User, clickedUser: PublicUser) => {
      if (!mapStateLoaded || !mapState || !geoJsonUsers) return;
      
      // check if other user is in geojson list
      const isOtherUserInGeoList = geoJsonUsers.features.some(
        (f) => f.properties?.id === clickedUser.id
      );
      const isPrevOtherUserInGeoList = geoJsonUsers.features.some(
        (f) => f.properties?.id === tempOtherUser?.id
      );
      
      // check if should remove marker
      const shouldRemoveMarker =
        tempOtherUserMarkerActive &&
        ((tempOtherUser && tempOtherUser.id !== clickedUser.id) ||
          isPrevOtherUserInGeoList);
      
      setOtherUser(clickedUser);
      
      // check if viewer has selected address
      const isViewerAddressSelected =
        companyAddressSelected.place_name !== "" &&
        startAddressSelected.place_name !== "";
      
      const companyCord: number[] = companyAddressSelected.center;
      const startCord: number[] = startAddressSelected.center;
      
      // calculate user start and company coordinates
      const userStartLng = isViewerAddressSelected
        ? startCord[0]
        : user.startCoordLng;
      const userStartLat = isViewerAddressSelected
        ? startCord[1]
        : user.startCoordLat;
      const userCompanyLng = isViewerAddressSelected
        ? companyCord[0]
        : user.companyCoordLng;
      const userCompanyLat = isViewerAddressSelected
        ? companyCord[1]
        : user.companyCoordLat;
      
      // user coordinates configuration
      const userCoord =
        !isViewerAddressSelected && user.role === "VIEWER"
          ? undefined
          : {
              startLat: userStartLat,
              startLng: userStartLng,
              endLat: userCompanyLat,
              endLng: userCompanyLng,
            };

      // if not viewer, update user and company location
      if (user.role !== "VIEWER") {
        updateUserLocation(mapState, userStartLng, userStartLat);
        updateCompanyLocation(
          mapState,
          userCompanyLng,
          userCompanyLat,
          user.role,
          user.id,
          true
        );
      }
      
      // remove previous temporary marker
      if (shouldRemoveMarker && tempOtherUser) {
        updateCompanyLocation(
          mapState,
          tempOtherUser.companyCoordLng,
          tempOtherUser.companyCoordLat,
          tempOtherUser.role,
          tempOtherUser.id,
          false,
          true
        );
        setTempOtherUserMarkerActive(false);
        setTempOtherUser(null);
      }
      
      // if other user is not in geojson list and is selected user
      if (!isOtherUserInGeoList && selectedUserId === clickedUser.id) {
        updateCompanyLocation(
          mapState,
          clickedUser.companyCoordLng,
          clickedUser.companyCoordLat,
          clickedUser.role,
          clickedUser.id,
          false,
          false
        );
        setTempOtherUserMarkerActive(true);
        setTempOtherUser(clickedUser);
      } else if (!isOtherUserInGeoList && selectedUserId !== clickedUser.id) {
        setOtherUser(null);
        return;
      }

      // route view properties
      const viewProps = {
        user,
        otherUser: clickedUser,
        map: mapState,
        userCoord,
      };

      // set route points based on user role
      if (user.role === "RIDER") {
        setPoints([
          [clickedUser.startPOICoordLng, clickedUser.startPOICoordLat],
          [userStartLng, userStartLat],
          [userCompanyLng, userCompanyLat],
          [clickedUser.companyCoordLng, clickedUser.companyCoordLat],
        ]);
      } else if (isViewerAddressSelected || user.role == "DRIVER") {
        setPoints([
          [userStartLng, userStartLat],
          [clickedUser.startPOICoordLng, clickedUser.startPOICoordLat],
          [clickedUser.companyCoordLng, clickedUser.companyCoordLat],
          [userCompanyLng, userCompanyLat],
        ]);
      } else {
        setPoints([
          [clickedUser.startPOICoordLng, clickedUser.startPOICoordLat],
          [clickedUser.companyCoordLng, clickedUser.companyCoordLat],
        ]);
      }
      viewRoute(viewProps);
    },
    [
      geoJsonUsers,
      selectedUserId,
      companyAddressSelected,
      startAddressSelected,
      mapState,
      mapStateLoaded,
      tempOtherUser,
      tempOtherUserMarkerActive,
    ]
  );
  
  // enhance sent users list
  const enhancedSentUsers = requests.sent.map((request: { toUser: any }) =>
    extendPublicUser(request.toUser!)
  );
  // enhance received users list, maybe enhance means add favorite and request status?
  const enhancedReceivedUsers = requests.received.map(
    (request: { fromUser: any }) => extendPublicUser(request.fromUser!)
  );
  // enhance recommendations list,
  const enhancedRecs = recommendations.map(extendPublicUser);
  // enhance favorites list
  const enhancedFavs = favorites.map(extendPublicUser);
  
  // update filters based on user information
  useEffect(() => {
    if (user && user.role !== "VIEWER") {
      // update filters parameters
      setFilters((prev) => ({
        ...prev,
        startDate: user.coopStartDate ? user.coopStartDate : prev.startDate,
        endDate: user.coopEndDate ? user.coopEndDate : prev.endDate,
        daysWorking: user.daysWorking,
      }));
    }
  }, [user]);

  // map initialization
  useEffect(() => {
    // map initialization
    if (!isMapInitialized.current && user && mapContainerRef.current) {
      isMapInitialized.current = true;
      const isViewer = user.role === "VIEWER";
      const neuLat = 42.33907; // Northeastern University latitude
      const neuLng = -71.088748; // Northeastern University longitude
      
      // create new map
      const newMap = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/light-v10",
        center: isViewer
          ? [neuLng, neuLat] // viewer centered at Northeastern University
          : [user.companyCoordLng, user.companyCoordLat], // other users centered at company
        zoom: 8,
      });

      newMap.on("load", () => {
        newMap.setMaxZoom(13);
        setMapState(newMap);
        addMapEvents(newMap, user, setPopupUsers);

        // initial set user and company location
        if (user.role !== "VIEWER") {
          updateUserLocation(newMap, user.startCoordLng, user.startCoordLat);
          updateCompanyLocation(
            newMap,
            user.companyCoordLng,
            user.companyCoordLat,
            user.role,
            user.id,
            true
          );
        }
        setMapStateLoaded(true);
      });
    }
  }, [mapContainerRef, user]);

  // update geojson users data
  useEffect(() => {
    if (mapState && geoJsonUsers && mapStateLoaded) {
      updateGeoJsonUsers(mapState, geoJsonUsers);
    }
  }, [mapState, geoJsonUsers, mapStateLoaded]);

  // user location rendering, separate useEffect
  useEffect(() => {
    if (mapStateLoaded && mapState && user) {
      if (user.role === "VIEWER") {
        updateUserLocation(
          mapState,
          startAddressSelected.center[0],
          startAddressSelected.center[1]
        );
        updateCompanyLocation(
          mapState,
          companyAddressSelected.center[0],
          companyAddressSelected.center[1],
          Role.VIEWER,
          user.id,
          true
        );
      }
      if (otherUser) {
        onViewRouteClick(user, otherUser);
      }
    }
  }, [
    companyAddressSelected,
    mapState,
    mapStateLoaded,
    onViewRouteClick,
    otherUser,
    startAddressSelected,
    user,
  ]);
  
  // reset selected user when sidebar type changes
  useEffect(() => {
    setSelectedUserId(null);
  }, [sidebarType]);

  // initial route rendering
  useEffect(() => {
    if (
      user &&
      !otherUser &&
      mapState &&
      mapStateLoaded &&
      (user.role !== "VIEWER" ||
        (startAddressSelected.center[0] !== 0 &&
          companyAddressSelected.center[0] !== 0))
    ) {
      let userCoord = {
        startLat: user.startCoordLat,
        startLng: user.startCoordLng,
        endLat: user.companyCoordLat,
        endLng: user.companyCoordLng,
      };
      if (user.role == "VIEWER") {
        userCoord = {
          startLng: startAddressSelected.center[0],
          startLat: startAddressSelected.center[1],
          endLng: companyAddressSelected.center[0],
          endLat: companyAddressSelected.center[1],
        };
      }
      
      // remove temporary user marker
      if (tempOtherUserMarkerActive && tempOtherUser) {
        updateCompanyLocation(
          mapState,
          tempOtherUser.companyCoordLng,
          tempOtherUser.companyCoordLat,
          tempOtherUser.role,
          tempOtherUser.id,
          false,
          true
        );
        setTempOtherUserMarkerActive(false);
        setTempOtherUser(null);
      }
      
      const viewProps = {
        user,
        otherUser: undefined,
        map: mapState,
        userCoord,
      };

      // set initial route points
      setPoints([
        [userCoord.startLng, userCoord.startLat],
        [userCoord.endLng, userCoord.endLat],
      ]);
      viewRoute(viewProps);
    }
  }, [
    companyAddressSelected,
    mapState,
    mapStateLoaded,
    otherUser,
    startAddressSelected,
    user,
    tempOtherUser,
    tempOtherUserMarkerActive,
  ]);
  
  // use search hook to get company address suggestions
  useSearch({
    value: companyAddress,
    type: "address%2Cpostcode",
    setFunc: setCompanyAddressSuggestions,
  });

  // use search hook to get start address suggestions
  useSearch({
    value: startingAddress,
    type: "address%2Cpostcode",
    setFunc: setStartAddressSuggestions,
  });
  
  // get route direction
  useGetDirections({ points: points, map: mapState! });

  // if user is not loaded, show loading animation
  if (!user) {
    return <Spinner />;
  }

  // viewer search box component
  const viewerBox = (
    <div className="absolute left-0 top-0 z-10 m-2 flex min-w-[25rem] flex-col rounded-xl bg-white p-4 shadow-lg ">
      <h2 className="mb-4 text-xl">Search my route</h2>
      <div className="flex items-center space-x-4">
        <Image
          className="h-8 w-8"
          src={BlueCircle}
          alt="start"
          width={32}
          height={32}
        />
        <AddressCombobox
          name="startAddress"
          placeholder="Enter start address"
          addressSelected={startAddressSelected}
          addressSetter={setStartAddressSelected}
          addressSuggestions={startAddressSuggestions}
          addressUpdater={updateStartingAddress}
          className="flex-1"
        />
      </div>

      <div className="mt-4 flex items-center space-x-4">
        <Image
          className="h-8 w-8 "
          alt="end"
          src={BlueSquare}
          width={32}
          height={42}
        />
        <AddressCombobox
          name="companyAddress"
          placeholder="Enter company address"
          addressSelected={companyAddressSelected}
          addressSetter={setCompanyAddressSelected}
          addressSuggestions={companyAddressSuggestions}
          addressUpdater={updateCompanyAddress}
          className="flex-1 "
        />
      </div>
      <div className="flex items-center space-x-4">
        <VisibilityToggle
          map={mapState}
          style={{
            width: "100%",
            marginTop: "20px",
            backgroundColor: "white",
            borderRadius: "8px",
            borderColor: "black",
          }}
        />
      </div>
    </div>
  );
  
  // main component rendering
  return (
    <>
      <UserContext.Provider value={user}>
        <ToastProvider
          placement="top-right"
          autoDismiss={true}
          newestOnTop={true}
        >
          <Head>
            <title>CarpoolNU</title>
          </Head>
          <div className="m-0 h-full max-h-screen w-full">
            {/* header component */}
            <Header
              data={{
                sidebarValue: sidebarType,
                setSidebar: setSidebarType,
                disabled: user.status === "INACTIVE" && user.role !== "VIEWER",
              }}
            />
            <div className="flex h-[91.5%] overflow-hidden">
              {/* sidebar */}
              <div className="w-[25rem]  ">
                {mapState && (
                  <SidebarPage
                    setSort={setSort}
                    sort={sort}
                    setFilters={setFilters}
                    filters={filters}
                    defaultFilters={defaultFilters}
                    sidebarType={sidebarType}
                    role={user.role}
                    map={mapState}
                    recs={enhancedRecs}
                    favs={enhancedFavs}
                    received={enhancedReceivedUsers}
                    sent={enhancedSentUsers}
                    onViewRouteClick={onViewRouteClick}
                    onUserSelect={handleUserSelect}
                    selectedUser={selectedUser}
                  />
                )}
              </div>

              {/* map focus button */}
              <button
                className="absolute bottom-[150px] right-[8px] z-10 flex h-8 w-8 items-center justify-center rounded-md border-2 border-solid border-gray-300 bg-white shadow-sm hover:bg-gray-200"
                id="fly"
              >
                <RiFocus3Line />
              </button>
              
              {/* map container */}
              <div className="relative flex-auto">
                {/* message panel */}
                {selectedUser && (
                  <div className=" pointer-events-none absolute inset-0 z-10 h-full w-full">
                    <MessagePanel
                      selectedUser={selectedUser}
                      onMessageSent={handleMessageSent}
                      onViewRouteClick={onViewRouteClick}
                      onCloseConversation={handleUserSelect}
                    />
                  </div>
                )}

                {/* map container */}
                <div
                  ref={mapContainerRef}
                  id="map"
                  className="pointer-events-auto relative  z-0 h-full w-full flex-auto"
                >
                  {/* viewer search box */}
                  {user.role === "VIEWER" && viewerBox}
                  {/* map legend */}
                  <MapLegend role={user.role} />
                  {/* map connect portal */}
                  <MapConnectPortal
                    otherUsers={popupUsers}
                    extendUser={extendPublicUser}
                    onViewRouteClick={onViewRouteClick}
                    onViewRequest={handleUserSelect}
                    onClose={() => {
                      setPopupUsers(null);
                    }}
                  />
                  {/* inactive blocker, not sure what it is */}
                  {user.status === "INACTIVE" && user.role !== "VIEWER" && (
                    <InactiveBlocker />
                  )}
                </div>
              </div>
            </div>
          </div>
        </ToastProvider>
      </UserContext.Provider>
    </>
  );
};

export default Home;
