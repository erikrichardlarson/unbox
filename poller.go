package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	bbs "github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/chromedp/chromedp"
	"github.com/gorilla/websocket"
	"github.com/icedream/go-stagelinq"
	_ "github.com/mattn/go-sqlite3"
)

var (
	embeddedRBKey string
)

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#7D56F4")).
			MarginBottom(1)

	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#04B575"))

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF6B6B"))

	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#626262"))

	selectedStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#7D56F4"))

	normalStyle = lipgloss.NewStyle()
)

type TrackDetails struct {
	Artist           string    `json:"artist"`
	Track            string    `json:"track"`
	Label            string    `json:"label,omitempty"`
	Remix            string    `json:"remix,omitempty"`
	Artwork          string    `json:"artwork,omitempty"`
	BPM              float64   `json:"bpm,omitempty"`
	Key              string    `json:"key,omitempty"`
	Genre            string    `json:"genre,omitempty"`
	Album            string    `json:"album,omitempty"`
	Comments         string    `json:"comments,omitempty"`
	Date             string    `json:"date,omitempty"`
	Time             time.Time `json:"-"`
	PropVolume       float64   `json:"-"`
	PropXfaderAdjust float64   `json:"-"`
	IsPlaying        bool      `json:"-"`
	DateAdded        string    `json:"-"`
}

type DJMode string

const (
	ModeRekordbox DJMode = "Rekordbox"
	ModeSerato    DJMode = "Serato"
	ModeTraktor   DJMode = "Traktor"
	ModeVirtualDJ DJMode = "VirtualDJ"
	ModeMixxx     DJMode = "Mixxx"
	ModeDJUCED    DJMode = "DJUCED"
	ModeDjayPro   DJMode = "djay Pro"
	ModeDenon     DJMode = "Denon"
)

type trackDetectedMsg struct {
	track TrackDetails
}

type errorMsg struct {
	err error
}

type statusMsg string

type logUpdateMsg struct{}

type Model struct {
	mode          DJMode
	modes         []DJMode
	selectedIndex int
	isRunning     bool
	currentTrack  *TrackDetails
	recentTracks  []TrackDetails
	status        string
	err           error
	trackTable    table.Model
	showHelp      bool
	width         int
	height        int

	seratoInput       textinput.Model
	inputtingSeratoID bool
	seratoUserID      string

	poller     *Poller
	ctx        context.Context
	cancelFunc context.CancelFunc

	wsServer        *http.Server
	virtualDJServer *http.Server
	traktorServer   *http.Server

	trackChan chan TrackDetails

	stagelinqListener *stagelinq.Listener
	stagelinqDevices  map[string]*stagelinq.Device
	stagelinqMu       sync.Mutex

	logger  *log.Logger
	spinner bbs.Model

	showLogs    bool
	logViewport viewport.Model
	logBuffer   []string
	logBufferMu sync.Mutex
	maxLogLines int
}

type Poller struct {
	mode             DJMode
	lastTrack        *TrackDetails
	lastTrackMu      sync.Mutex
	wsClients        map[*websocket.Conn]bool
	wsClientsMu      sync.Mutex
	upgrader         websocket.Upgrader
	httpClient       *http.Client
	virtualDJDecks   map[string]TrackDetails
	virtualDJDecksMu sync.Mutex
	traktorDecks     map[string]*TrackDetails
	traktorDecksMu   sync.Mutex
	trackChan        chan TrackDetails
	logger           *log.Logger
}

func initialModel(logger *log.Logger) Model {

	modes := []DJMode{
		ModeRekordbox,
		ModeSerato,
		ModeTraktor,
		ModeVirtualDJ,
		ModeMixxx,
		ModeDJUCED,
		ModeDjayPro,
		ModeDenon,
	}

	columns := []table.Column{
		{Title: "Time", Width: 8},
		{Title: "Artist", Width: 25},
		{Title: "Track", Width: 35},
		{Title: "Label", Width: 20},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(false),
		table.WithHeight(10),
	)

	tableStyle := table.DefaultStyles()
	tableStyle.Header = tableStyle.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		Bold(false)
	tableStyle.Selected = tableStyle.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	t.SetStyles(tableStyle)

	ti := textinput.New()
	ti.Placeholder = "Your Serato User ID"
	ti.CharLimit = 50
	ti.Width = 30
	ti.Prompt = "❯ "
	ti.Blur()

	s := bbs.New()
	s.Spinner = bbs.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("cyan"))

	vp := viewport.New(80, 20)
	vp.Style = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62"))

	return Model{
		modes:             modes,
		mode:              modes[0],
		selectedIndex:     0,
		trackTable:        t,
		recentTracks:      make([]TrackDetails, 0, 50),
		trackChan:         make(chan TrackDetails, 10),
		stagelinqDevices:  make(map[string]*stagelinq.Device),
		seratoInput:       ti,
		inputtingSeratoID: false,
		seratoUserID:      "",
		logger:            logger,
		spinner:           s,
		showLogs:          false,
		logViewport:       vp,
		logBuffer:         make([]string, 0, 1000),
		maxLogLines:       1000,
	}
}

func (m *Model) Init() tea.Cmd {
	return tea.Batch(
		tea.EnterAltScreen,
		m.waitForTrack(),
		m.tickLogs(),
	)
}

func (m *Model) waitForTrack() tea.Cmd {
	return func() tea.Msg {
		track := <-m.trackChan
		return trackDetectedMsg{track: track}
	}
}

func (m *Model) tickLogs() tea.Cmd {
	return tea.Tick(time.Millisecond*100, func(t time.Time) tea.Msg {
		return logUpdateMsg{}
	})
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	if m.inputtingSeratoID {
		switch msg := msg.(type) {
		case tea.KeyMsg:
			switch msg.Type {
			case tea.KeyEnter:
				m.seratoUserID = m.seratoInput.Value()
				m.inputtingSeratoID = false
				m.seratoInput.Blur()
				m.status = statusStyle.Render(fmt.Sprintf("Serato User ID set to: %s", m.seratoUserID))
				return m, nil
			case tea.KeyEsc:
				m.inputtingSeratoID = false
				m.seratoInput.Blur()
				m.status = "Serato User ID input cancelled."
				return m, nil
			case tea.KeyCtrlC:
				m.cleanup()
				return m, tea.Quit
			}
		}

		m.seratoInput, cmd = m.seratoInput.Update(msg)
		cmds = append(cmds, cmd)
		return m, tea.Batch(cmds...)
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.showLogs {
			switch msg.String() {
			case "ctrl+c", "q":
				m.cleanup()
				return m, tea.Quit
			case "l", "esc":
				m.showLogs = false
				return m, nil
			case "g":
				m.logViewport.GotoTop()
			case "G":
				m.logViewport.GotoBottom()
			}

			m.logViewport, cmd = m.logViewport.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}

		switch msg.String() {
		case "ctrl+c", "q":
			m.cleanup()
			return m, tea.Quit
		case "up", "k":
			if !m.isRunning && m.selectedIndex > 0 {
				m.selectedIndex--
				m.mode = m.modes[m.selectedIndex]
			}
		case "down", "j":
			if !m.isRunning && m.selectedIndex < len(m.modes)-1 {
				m.selectedIndex++
				m.mode = m.modes[m.selectedIndex]
			}
		case "s":
			if !m.isRunning && m.modes[m.selectedIndex] == ModeSerato {
				m.inputtingSeratoID = true
				m.seratoInput.SetValue(m.seratoUserID)
				m.seratoInput.Focus()
				m.status = "Enter Serato User ID (Press Enter to save, Esc to cancel)"
				cmds = append(cmds, textinput.Blink)
			}
		case "enter", " ":
			if !m.isRunning {
				if m.modes[m.selectedIndex] == ModeSerato && m.seratoUserID == "" {
					m.status = errorStyle.Render("Serato User ID is required. Press 's' to set it.")
					return m, nil
				}
				m.isRunning = true
				m.status = fmt.Sprintf("Starting %s monitoring...", m.mode)
				cmds = append(cmds, m.startPolling, m.spinner.Tick)
			} else {
				m.stopPolling()
				m.isRunning = false
				m.status = "Monitoring stopped"
			}
		case "h", "?":
			m.showHelp = !m.showHelp
		case "c":
			m.recentTracks = make([]TrackDetails, 0, 50)
			m.updateTrackTable()
		case "l":
			m.showLogs = true
			m.updateLogViewport()
			m.logViewport.GotoBottom()
			return m, nil
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.trackTable.SetHeight(min(10, m.height-20))
		m.trackTable.SetWidth(m.width - 4)

		m.logViewport.Width = m.width - 4
		m.logViewport.Height = m.height - 8
		if m.showLogs {
			m.updateLogViewport()
		}

	case trackDetectedMsg:
		m.currentTrack = &msg.track
		m.recentTracks = append([]TrackDetails{msg.track}, m.recentTracks...)
		if len(m.recentTracks) > 50 {
			m.recentTracks = m.recentTracks[:50]
		}
		m.updateTrackTable()
		cmds = append(cmds, m.waitForTrack())

	case errorMsg:
		m.err = msg.err
		m.status = errorStyle.Render(fmt.Sprintf("Error: %v", msg.err))

	case statusMsg:
		m.status = string(msg)

	case bbs.TickMsg:
		var spinnerCmd tea.Cmd
		m.spinner, spinnerCmd = m.spinner.Update(msg)
		cmds = append(cmds, spinnerCmd)

	case logUpdateMsg:
		if m.showLogs {
			m.updateLogViewport()
		}
		cmds = append(cmds, m.tickLogs())
	}

	if !m.inputtingSeratoID {
		var tableCmd tea.Cmd
		m.trackTable, tableCmd = m.trackTable.Update(msg)

		if m.showLogs {
			m.logViewport, cmd = m.logViewport.Update(msg)
			cmds = append(cmds, cmd)
		}

		cmds = append(cmds, tableCmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) View() string {
	if m.showLogs {
		return m.renderLogView()
	}

	var s strings.Builder

	if m.inputtingSeratoID {
		s.WriteString(titleStyle.Render("🎵 Unbox") + "\n\n")
		s.WriteString(lipgloss.NewStyle().Bold(true).Render("Enter Serato User ID") + "\n")
		s.WriteString(m.seratoInput.View() + "\n\n")
		if m.status != "" {
			s.WriteString(helpStyle.Render(m.status) + "\n\n")
		}
		s.WriteString(helpStyle.Render("Press Enter to save, Esc to cancel, Ctrl+C to Quit"))
		return s.String()
	}

	s.WriteString(titleStyle.Render("unbox") + "\n\n")

	if !m.isRunning {
		s.WriteString("Select DJ Software:\n\n")
		for i, modeName := range m.modes {
			currentModeText := string(modeName)

			if modeName == ModeSerato {
				if m.seratoUserID != "" {
					currentModeText = fmt.Sprintf("%s (ID: %s)", modeName, m.seratoUserID)
				} else {
					currentModeText = fmt.Sprintf("%s (ID not set - press 's')", modeName)
				}
			}

			if i == m.selectedIndex {
				s.WriteString(selectedStyle.Render(fmt.Sprintf("▶ %s", currentModeText)) + "\n")
			} else {
				s.WriteString(normalStyle.Render(fmt.Sprintf("   %s", currentModeText)) + "\n")
			}
		}
		s.WriteString("\n")
	} else {
		modeDisplay := string(m.mode)
		if m.mode == ModeSerato && m.seratoUserID != "" {
			modeDisplay = fmt.Sprintf("%s (ID: %s)", m.mode, m.seratoUserID)
		}
		s.WriteString(fmt.Sprintf("Mode: %s %s\n\n", m.spinner.View(), selectedStyle.Render(modeDisplay)))
	}

	if m.currentTrack != nil {
		s.WriteString(statusStyle.Render("Now Playing:") + "\n")

		trackInfo := [][]string{
			{"Artist:", m.currentTrack.Artist},
			{"Track:", m.currentTrack.Track},
		}
		if m.currentTrack.Label != "" {
			trackInfo = append(trackInfo, []string{"Label:", m.currentTrack.Label})
		}
		if m.currentTrack.Remix != "" {
			trackInfo = append(trackInfo, []string{"Remix:", m.currentTrack.Remix})
		}

		maxNowPlayingLabelWidth := 0
		for _, item := range trackInfo {
			if len(item[0]) > maxNowPlayingLabelWidth {
				maxNowPlayingLabelWidth = len(item[0])
			}
		}

		nowPlayingStyle := lipgloss.NewStyle().PaddingLeft(2)
		for _, item := range trackInfo {
			label := lipgloss.NewStyle().Width(maxNowPlayingLabelWidth + 1).Render(item[0])
			value := item[1]
			s.WriteString(nowPlayingStyle.Render(fmt.Sprintf("%s %s", label, value)) + "\n")
		}
		s.WriteString("\n")
	}

	if m.status != "" {
		s.WriteString(m.status + "\n\n")
	}

	if len(m.recentTracks) > 0 {
		s.WriteString("Recent Tracks:\n")
		s.WriteString(m.trackTable.View() + "\n")
	}

	if m.isRunning {
		s.WriteString("\nIntegration URLs:\n")

		overlayInfo := [][]string{
			{"WebSocket:", "ws://localhost:8080/ws"},
		}
		if m.mode == ModeVirtualDJ {
			overlayInfo = append(overlayInfo, []string{"VirtualDJ API:", "http://localhost:8081"})
		} else if m.mode == ModeTraktor {
			overlayInfo = append(overlayInfo, []string{"Traktor API:", "http://localhost:8081"})
		} else if m.mode == ModeDenon {
			overlayInfo = append(overlayInfo, []string{"StagelinQ:", "Listening for Denon devices..."})
			if len(m.stagelinqDevices) > 0 {
				overlayInfo = append(overlayInfo, []string{"Connected:", fmt.Sprintf("%d device(s)", len(m.stagelinqDevices))})
			}
		}

		maxOverlayLabelWidth := 0
		for _, item := range overlayInfo {
			if len(item[0]) > maxOverlayLabelWidth {
				maxOverlayLabelWidth = len(item[0])
			}
		}

		overlayStyle := lipgloss.NewStyle().PaddingLeft(2)
		for _, item := range overlayInfo {
			label := lipgloss.NewStyle().Width(maxOverlayLabelWidth + 1).Render(item[0])
			value := helpStyle.Render(item[1])
			s.WriteString(overlayStyle.Render(fmt.Sprintf("%s %s", label, value)) + "\n")
		}
		s.WriteString("\n")
	}

	if m.showHelp {
		help := []string{
			"Keys:",
			"  ↑/↓ or j/k - Navigate modes",
			"  Enter/Space - Start/Stop monitoring",
			"  s - Set Serato User ID (if Serato mode selected)",
			"  c - Clear recent tracks",
			"  l - View logs",
			"  h/? - Toggle help",
			"  q/Ctrl+C - Quit",
		}
		s.WriteString(helpStyle.Render(strings.Join(help, "\n")) + "\n")
	} else {
		s.WriteString(helpStyle.Render("Press h for help, l for logs, q to quit\n"))
	}

	return s.String()
}

func (m *Model) updateTrackTable() {
	rows := []table.Row{}
	for _, track := range m.recentTracks {
		rows = append(rows, table.Row{
			track.Time.Format("15:04:05"),
			truncate(track.Artist, 25),
			truncate(track.Track, 35),
			truncate(track.Label, 20),
		})
	}
	m.trackTable.SetRows(rows)
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (m *Model) startPolling() tea.Msg {
	m.poller = &Poller{
		mode:           m.mode,
		wsClients:      make(map[*websocket.Conn]bool),
		virtualDJDecks: make(map[string]TrackDetails),
		traktorDecks:   make(map[string]*TrackDetails),
		trackChan:      m.trackChan,
		logger:         m.logger,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}

	go m.startWebSocketServer()

	switch m.mode {
	case ModeVirtualDJ:
		go m.startVirtualDJServer()
	case ModeTraktor:
		go m.startTraktorServer()
	case ModeDenon:
		go m.startStagelinQ()
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.ctx = ctx
	m.cancelFunc = cancel

	go m.pollDJSoftware(ctx)

	return statusMsg(fmt.Sprintf("%s monitoring started", m.mode))
}

func (m *Model) stopPolling() {
	if m.cancelFunc != nil {
		m.cancelFunc()
	}
	m.cleanup()
}

func (m *Model) cleanup() {
	if m.wsServer != nil {
		m.wsServer.Close()
	}
	if m.virtualDJServer != nil {
		m.virtualDJServer.Close()
	}
	if m.traktorServer != nil {
		m.traktorServer.Close()
	}

	if m.stagelinqListener != nil {
		m.stagelinqListener.Close()
		m.stagelinqListener = nil
	}
}

func (m *Model) pollDJSoftware(ctx context.Context) {
	if m.mode == ModeDenon {
		return
	}

	ticker := time.NewTicker(m.getPollInterval())
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var err error
			switch m.mode {
			case ModeRekordbox:
				err = m.poller.pollRekordbox()
			case ModeSerato:
				if m.seratoUserID != "" {
					err = m.poller.pollSerato(m.seratoUserID)
				} else {
					m.trackChan <- TrackDetails{Artist: "Error", Track: "Serato User ID not set.", Time: time.Now()}
				}
			case ModeMixxx:
				err = m.poller.pollMixxx()
			case ModeDJUCED:
				err = m.poller.pollDJUCED()
			case ModeDjayPro:
				err = m.poller.pollDjayPro()
			}

			if err != nil {
				continue
			}
		}
	}
}

func (m *Model) getPollInterval() time.Duration {
	switch m.mode {
	case ModeDjayPro:
		return 3 * time.Second
	case ModeSerato:
		return 30 * time.Second
	default:
		return 10 * time.Second
	}
}

func (m *Model) startWebSocketServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", m.poller.handleWebSocket)

	m.wsServer = &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	m.wsServer.ListenAndServe()
}

func (m *Model) startVirtualDJServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/deckLoaded", m.poller.handleVirtualDJDeckLoaded)
	mux.HandleFunc("/activeDeck", m.poller.handleVirtualDJActiveDeck)

	m.virtualDJServer = &http.Server{
		Addr:    ":8081",
		Handler: mux,
	}

	m.virtualDJServer.ListenAndServe()
}

func (m *Model) startTraktorServer() {
	m.logger.Println("Traktor: Starting Traktor HTTP server on :8081")
	mux := http.NewServeMux()
	mux.HandleFunc("/deckLoaded", m.poller.handleTraktorDeckLoaded)
	mux.HandleFunc("/updateDeck", m.poller.handleTraktorUpdateDeck)
	mux.HandleFunc("/log", m.poller.handleTraktorLog)

	m.traktorServer = &http.Server{
		Addr:    ":8081",
		Handler: mux,
	}

	go func() {
		m.logger.Println("Traktor: Traktor HTTP server listening on :8081")
		if err := m.traktorServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			m.logger.Printf("Traktor: Traktor HTTP server ListenAndServe error: %v", err)
		}
		m.logger.Println("Traktor: Traktor HTTP server shut down.")
	}()
}

func (p *Poller) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := p.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	p.wsClientsMu.Lock()
	p.wsClients[conn] = true
	p.wsClientsMu.Unlock()

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}

	p.wsClientsMu.Lock()
	delete(p.wsClients, conn)
	p.wsClientsMu.Unlock()
}

func (p *Poller) BroadcastMessage(message interface{}) {
	p.logger.Printf("BroadcastMessage: Entered. Attempting to broadcast message: %+v\n", message)

	p.wsClientsMu.Lock()
	defer p.wsClientsMu.Unlock()

	clientCount := len(p.wsClients)
	p.logger.Printf("BroadcastMessage: Broadcasting to %d clients.\n", clientCount)

	if clientCount == 0 {
		p.logger.Println("BroadcastMessage: No clients connected, skipping broadcast.")
		return
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		p.logger.Printf("BroadcastMessage: Error marshalling JSON: %v. Message: %+v\n", err, message)
		return
	}
	p.logger.Printf("BroadcastMessage: Marshalled JSON data: %s\n", string(jsonData))

	for client, active := range p.wsClients {
		if !active {
			p.logger.Printf("BroadcastMessage: Client %p is inactive, skipping.\n", client)
			continue
		}
		p.logger.Printf("BroadcastMessage: Attempting to send to client %p\n", client)
		if err := client.WriteMessage(websocket.TextMessage, jsonData); err != nil {
			p.logger.Printf("BroadcastMessage: Error writing message to client %p: %v\n", client, err)
		} else {
			p.logger.Printf("BroadcastMessage: Successfully sent message to client %p\n", client)
		}
	}
	p.logger.Println("BroadcastMessage: Finished.")
}

func (p *Poller) isNewTrack(currentTrack TrackDetails) bool {
	p.lastTrackMu.Lock()
	defer p.lastTrackMu.Unlock()

	if p.lastTrack == nil ||
		strings.TrimSpace(p.lastTrack.Artist) != strings.TrimSpace(currentTrack.Artist) ||
		strings.TrimSpace(p.lastTrack.Track) != strings.TrimSpace(currentTrack.Track) {
		newLastTrack := currentTrack
		p.lastTrack = &newLastTrack
		return true
	}
	return false
}

func (p *Poller) getArtworkAsBase64(artworkPath string) (string, error) {
	if artworkPath == "" {
		return "", nil
	}

	data, err := os.ReadFile(artworkPath)
	if err != nil {
		return "", err
	}

	mimeType := http.DetectContentType(data)
	if !strings.HasPrefix(mimeType, "image/") {
		ext := strings.ToLower(filepath.Ext(artworkPath))
		if ext == ".jpg" || ext == ".jpeg" {
			mimeType = "image/jpeg"
		} else if ext == ".png" {
			mimeType = "image/png"
		}
	}

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(data)), nil
}

func getRekordboxPaths(homeDir string) (optionsPath, shareDirBase string, err error) {
	switch runtime.GOOS {
	case "darwin":
		optionsPath = filepath.Join(homeDir, "Library", "Application Support", "Pioneer", "rekordboxAgent", "storage", "options.json")
		shareDirBase = filepath.Join(homeDir, "Library", "Pioneer", "rekordbox", "share")
	case "windows":
		appDataDir := os.Getenv("APPDATA")
		if appDataDir == "" {
			return "", "", fmt.Errorf("APPDATA environment variable not set on Windows")
		}
		optionsPath = filepath.Join(appDataDir, "Pioneer", "rekordboxAgent", "storage", "options.json")
		shareDirBase = filepath.Join(appDataDir, "Pioneer", "rekordbox", "share")
	default:
		configDir, e := os.UserConfigDir()
		if e != nil {
			configDir = filepath.Join(homeDir, ".config")
		}
		optionsPath = filepath.Join(configDir, "Pioneer", "rekordboxAgent", "storage", "options.json")
		shareDirBase = filepath.Join(homeDir, ".local", "share", "Pioneer", "rekordbox", "share")
	}
	return
}

func getDJUCEDDBPath(homeDir string) (string, error) {
	switch runtime.GOOS {
	case "windows":
		userProfile := os.Getenv("USERPROFILE")
		if userProfile == "" {
			return "", fmt.Errorf("USERPROFILE environment variable not set on Windows")
		}
		return filepath.Join(userProfile, "Documents", "DJUCED", "DJUCED.db"), nil
	case "darwin":
		return filepath.Join(homeDir, "Documents", "DJUCED", "DJUCED.db"), nil
	default:
		return filepath.Join(homeDir, "Documents", "DJUCED", "DJUCED.db"), nil
	}
}

func getMixxxDBPath(homeDir string) (string, error) {
	switch runtime.GOOS {
	case "darwin":
		standardPath := filepath.Join(homeDir, "Library", "Application Support", "Mixxx", "mixxxdb.sqlite")
		sandboxedPath := filepath.Join(homeDir, "Library", "Containers", "org.mixxx.mixxx", "Data", "Library", "Application Support", "Mixxx", "mixxxdb.sqlite")
		if _, err := os.Stat(sandboxedPath); err == nil {
			return sandboxedPath, nil
		}
		return standardPath, nil
	case "windows":
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			return "", fmt.Errorf("LOCALAPPDATA environment variable not set on Windows")
		}
		return filepath.Join(localAppData, "Mixxx", "mixxxdb.sqlite"), nil
	default:
		path1 := filepath.Join(homeDir, ".mixxx", "mixxxdb.sqlite")
		path2 := filepath.Join(homeDir, ".config", "Mixxx", "mixxxdb.sqlite")
		if _, err := os.Stat(path1); err == nil {
			return path1, nil
		}
		return path2, nil
	}
}

func (p *Poller) pollRekordbox() error {
	p.logger.Println("Rekordbox: Starting poll...")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		p.logger.Printf("Rekordbox: Error getting user home directory: %v\n", err)
		return fmt.Errorf("Rekordbox: could not get user home directory: %w", err)
	}
	p.logger.Println("Rekordbox: Got user home directory.")

	optionsPath, rekordboxShareDirBase, err := getRekordboxPaths(homeDir)
	if err != nil {
		p.logger.Printf("Rekordbox: Error getting paths: %v\n", err)
		return fmt.Errorf("Rekordbox: error getting paths: %w", err)
	}
	p.logger.Printf("Rekordbox: Options path: %s, Share dir base: %s\n", optionsPath, rekordboxShareDirBase)

	if _, err := os.Stat(optionsPath); os.IsNotExist(err) {
		p.logger.Println("Rekordbox: options.json not found, skipping poll.")
		return nil
	}
	p.logger.Println("Rekordbox: options.json found.")

	optionsData, err := os.ReadFile(optionsPath)
	if err != nil {
		p.logger.Printf("Rekordbox: Error reading options.json: %v\n", err)
		return fmt.Errorf("Rekordbox: could not read options.json: %w", err)
	}
	p.logger.Println("Rekordbox: Read options.json successfully.")

	var parsedOptions struct {
		Options [][]interface{} `json:"options"`
	}
	if err := json.Unmarshal(optionsData, &parsedOptions); err != nil {
		var oldParsedOptions map[string][][]interface{}
		if errOld := json.Unmarshal(optionsData, &oldParsedOptions); errOld != nil {
			p.logger.Printf("Rekordbox: Error parsing options.json (both attempts): %v / %v\n", err, errOld)
			return fmt.Errorf("Rekordbox: could not parse options.json: %v / %v", err, errOld)
		}
		if val, ok := oldParsedOptions["options"]; ok {
			parsedOptions.Options = val
			p.logger.Println("Rekordbox: Parsed options.json using old format.")
		} else {
			p.logger.Println("Rekordbox: 'options' key not found in options.json (old format).")
			return fmt.Errorf("Rekordbox: 'options' key not found in options.json")
		}
	} else {
		p.logger.Println("Rekordbox: Parsed options.json successfully (new format).")
	}

	if len(parsedOptions.Options) == 0 || len(parsedOptions.Options[0]) < 2 {
		p.logger.Println("Rekordbox: Unexpected structure in options.json.")
		return fmt.Errorf("Rekordbox: unexpected structure in options.json")
	}
	dbPath, ok := parsedOptions.Options[0][1].(string)
	if !ok || dbPath == "" {
		p.logger.Println("Rekordbox: Could not find database path in options.json.")
		return fmt.Errorf("Rekordbox: could not find database path in options.json")
	}
	p.logger.Printf("Rekordbox: Database path from options.json: %s\n", dbPath)

	currentRBKey := embeddedRBKey
	if currentRBKey == "" {
		p.logger.Println("Rekordbox: embeddedRBKey is empty. Falling back to hardcoded key for safety (if applicable) or failing.")
		return fmt.Errorf("Rekordbox: embeddedRBKey is not set. Build with RB_KEY environment variable or argument")
	}

	dsn := fmt.Sprintf("%s?_cipher=sqlcipher&_legacy=4&_key=%s", dbPath, currentRBKey)

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		p.logger.Printf("Rekordbox: Failed to open database (sql.Open): %v\n", err)
		return fmt.Errorf("Rekordbox: failed to open database (sql.Open): %w", err)
	}
	defer db.Close()

	query := `
        SELECT 
            h.created_at, 
            IFNULL(c.Title, '') as Track, 
            IFNULL(c.Subtitle, '') as Mix, 
            IFNULL(l.Name, '') as Label, 
            IFNULL(a.Name, '') as Artist,
            IFNULL(c.ImagePath, '') as ArtworkPath
        FROM djmdSongHistory as h
        JOIN djmdContent as c ON h.ContentID = c.ID
        LEFT JOIN djmdArtist as a ON c.ArtistID = a.ID
        LEFT JOIN djmdLabel as l ON l.ID = c.LabelID
        ORDER BY h.created_at DESC
        LIMIT 1;`
	p.logger.Println("Rekordbox: Executing main track history query...")
	row := db.QueryRow(query)
	var createdAt, trackName, mix, label, artist, artworkRelPath sql.NullString
	if err := row.Scan(&createdAt, &trackName, &mix, &label, &artist, &artworkRelPath); err != nil {
		if err == sql.ErrNoRows {
			p.logger.Println("Rekordbox: No track history found in djmdSongHistory.")
			return nil
		}
		p.logger.Printf("Rekordbox: Failed to query track history: %v\n", err)
		return fmt.Errorf("Rekordbox: failed to query track history: %w", err)
	}
	p.logger.Println("Rekordbox: Main track history query successful.")

	fullTrackName := strings.ToUpper(trackName.String)
	if mix.Valid && mix.String != "" {
		fullTrackName = fmt.Sprintf("%s (%s)", fullTrackName, strings.ToUpper(mix.String))
	}

	var artworkDataURL string
	if artworkRelPath.Valid && artworkRelPath.String != "" {
		fullArtworkPath := filepath.Join(rekordboxShareDirBase, artworkRelPath.String)
		p.logger.Printf("Rekordbox: Attempting to load artwork from: %s\n", fullArtworkPath)
		if _, err := os.Stat(fullArtworkPath); err == nil {
			artworkDataURL, _ = p.getArtworkAsBase64(fullArtworkPath)
			if artworkDataURL != "" {
				p.logger.Println("Rekordbox: Artwork loaded successfully.")
			} else {
				p.logger.Println("Rekordbox: Artwork found but failed to convert to base64.")
			}
		} else {
			p.logger.Printf("Rekordbox: Artwork file not found at %s: %v\n", fullArtworkPath, err)
		}
	} else {
		p.logger.Println("Rekordbox: No artwork path in database.")
	}

	trackDetails := TrackDetails{
		Artist:  strings.ToUpper(artist.String),
		Track:   fullTrackName,
		Label:   strings.ToUpper(label.String),
		Remix:   strings.ToUpper(mix.String),
		Artwork: artworkDataURL,
		Time:    time.Now(),
	}

	if p.isNewTrack(trackDetails) {
		p.logger.Printf("Rekordbox: New track detected: Artist: '%s', Track: '%s'. Broadcasting.\n", trackDetails.Artist, trackDetails.Track)
		p.BroadcastMessage(trackDetails)
		p.trackChan <- trackDetails
	} else {
		p.logger.Printf("Rekordbox: Track is the same as last detected (Artist: '%s', Track: '%s'). No broadcast.\n", trackDetails.Artist, trackDetails.Track)
	}
	p.logger.Println("Rekordbox: Poll finished.")
	return nil
}

func (p *Poller) pollSerato(userID string) error {
	p.logger.Printf("Serato: Starting poll for user ID: %s\n", userID)

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.NoSandbox,
		chromedp.Flag("headless", true),
	)

	allocCtx, cancelAlloc := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancelAlloc()

	taskCtx, cancelTask := chromedp.NewContext(allocCtx)
	defer cancelTask()

	ctx, cancel := context.WithTimeout(taskCtx, 30*time.Second)
	defer cancel()

	var latestPlaylistURL string
	var rawTrackDataJSON string

	userPlaylistsURL := fmt.Sprintf("https://serato.com/playlists/%s", userID)
	p.logger.Printf("Serato: Navigating to user playlists URL: %s\n", userPlaylistsURL)

	err := chromedp.Run(ctx,
		chromedp.Navigate(userPlaylistsURL),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
		chromedp.ActionFunc(func(ctx context.Context) error {
			primarySelector := "a.playlist-title"
			var found bool
			p.logger.Printf("Serato: Attempting to find the first playlist URL with primary selector: '%s'\n", primarySelector)

			err := chromedp.AttributeValue(primarySelector, "href", &latestPlaylistURL, &found, chromedp.ByQuery).Do(ctx)

			if err == nil && found && latestPlaylistURL != "" {
				p.logger.Printf("Serato: Found playlist URL with primary selector: %s\n", latestPlaylistURL)
				return nil
			}

			if err != nil {
				p.logger.Printf("Serato: Error querying for primary selector '%s': %v\n", primarySelector, err)
			} else if !found {
				p.logger.Printf("Serato: Primary selector '%s' did not find the element.\n", primarySelector)
			} else if latestPlaylistURL == "" {
				p.logger.Printf("Serato: Primary selector '%s' found element, but href is empty.\n", primarySelector)
			}

			fallbackSelector := "div.playlist-card a.playlist-title"
			p.logger.Printf("Serato: Primary selector failed. Trying fallback selector: '%s'\n", fallbackSelector)

			err = chromedp.AttributeValue(fallbackSelector, "href", &latestPlaylistURL, &found, chromedp.ByQuery).Do(ctx)
			if err != nil {
				p.logger.Printf("Serato: Error querying for fallback selector '%s': %v\n", fallbackSelector, err)
				return fmt.Errorf("error finding playlist link with fallback selector '%s': %w", fallbackSelector, err)
			}
			if !found || latestPlaylistURL == "" {
				p.logger.Printf("Serato: Fallback selector '%s' also failed (found: %t, URL: '%s').\n", fallbackSelector, found, latestPlaylistURL)
				return fmt.Errorf("no playlist URL found with primary selector '%s' or fallback '%s'", primarySelector, fallbackSelector)
			}

			p.logger.Printf("Serato: Found playlist URL with fallback selector: %s\n", latestPlaylistURL)
			return nil
		}),
	)

	if err != nil {
		p.logger.Printf("Serato: Error navigating to playlists page: %v\n", err)
		return err
	}

	if latestPlaylistURL == "" {
		p.logger.Printf("Serato: No playlist URL found for user %s\n", userID)
		return fmt.Errorf("no playlist URL found for Serato user %s", userID)
	}
	p.logger.Printf("Serato: Found latest playlist URL: %s\n", latestPlaylistURL)
	baseURL := "https://serato.com"
	err = chromedp.Run(ctx,
		chromedp.Navigate(baseURL+latestPlaylistURL),
		chromedp.WaitReady("body", chromedp.ByQuery),
		chromedp.Sleep(2*time.Second),
		chromedp.Evaluate(`
            (() => {
                try {
                    const trackSelectors = [
                        '.playlist-track',
                        'div.playlist-track',
                        '[class*="playlist-track"]',
                        'div[class*="track"]'
                    ];
                    
                    let tracks = null;
                    for (const selector of trackSelectors) {
                        tracks = document.querySelectorAll(selector);
                        if (tracks.length > 0) break;
                    }
                    
                    if (!tracks || tracks.length === 0) {
                        return JSON.stringify({ error: "No tracks found with any selector" });
                    }
                    
                    const lastTrack = tracks[tracks.length - 1];
                    
                    let artistTrackText = '';
                    
                    const textElements = lastTrack.querySelectorAll('*');
                    for (const elem of textElements) {
                        const text = elem.textContent.trim();
                        if (text && text.includes(' - ')) {
                            artistTrackText = text;
                            break;
                        }
                    }
                    
                    if (!artistTrackText && lastTrack.textContent) {
                        const lines = lastTrack.textContent.split('\n').map(l => l.trim()).filter(l => l);
                        for (const line of lines) {
                            if (line.includes(' - ')) {
                                artistTrackText = line;
                                break;
                            }
                        }
                    }
                    
                    if (!artistTrackText) {
                        return JSON.stringify({ error: "Could not extract artist/track text" });
                    }
                    
                    const parts = artistTrackText.split(' - ');
                    const artist = parts.length > 0 ? parts[0].trim() : '';
                    const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : '';

                    return JSON.stringify({ 
                        artist: artist, 
                        title: title,
                        rawText: artistTrackText
                    });
                } catch (e) {
                    return JSON.stringify({ error: e.toString() });
                }
            })();
        `, &rawTrackDataJSON),
	)

	if err != nil {
		p.logger.Printf("Serato: Error extracting track data: %v\n", err)
		return err
	}

	p.logger.Printf("Serato: Raw track data JSON: %s\n", rawTrackDataJSON)

	if rawTrackDataJSON == "" || rawTrackDataJSON == "null" {
		p.logger.Println("Serato: No track data found on playlist page")
		return nil
	}

	var seratoTrack struct {
		Artist  string `json:"artist"`
		Title   string `json:"title"`
		RawText string `json:"rawText,omitempty"`
		Error   string `json:"error,omitempty"`
	}

	if err := json.Unmarshal([]byte(rawTrackDataJSON), &seratoTrack); err != nil {
		p.logger.Printf("Serato: Error unmarshaling track data: %v, raw data: %s\n", err, rawTrackDataJSON)
		return err
	}

	if seratoTrack.Error != "" {
		p.logger.Printf("Serato: JavaScript error: %s\n", seratoTrack.Error)
		return fmt.Errorf("JavaScript evaluation error: %s", seratoTrack.Error)
	}

	if seratoTrack.RawText != "" {
		p.logger.Printf("Serato: Raw track text: '%s'\n", seratoTrack.RawText)
	}

	trackDetails := TrackDetails{
		Artist: strings.TrimSpace(seratoTrack.Artist),
		Track:  strings.TrimSpace(seratoTrack.Title),
		Time:   time.Now(),
	}
	p.logger.Printf("Serato: Parsed track - Artist: '%s', Track: '%s'\n", trackDetails.Artist, trackDetails.Track)

	if trackDetails.Artist == "" && trackDetails.Track == "" {
		p.logger.Println("Serato: Both artist and track are empty, skipping")
		return nil
	}

	if p.isNewTrack(trackDetails) {
		p.logger.Printf("Serato: New track detected! Artist: '%s', Track: '%s'\n", trackDetails.Artist, trackDetails.Track)
		p.BroadcastMessage(trackDetails)
		p.trackChan <- trackDetails
	} else {
		p.logger.Printf("Serato: Track is same as last (Artist: '%s', Track: '%s'), not broadcasting\n", trackDetails.Artist, trackDetails.Track)
	}

	p.logger.Println("Serato: Poll completed successfully")
	return nil
}

func (p *Poller) pollMixxx() error {
	p.logger.Println("Mixxx: Starting poll...")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		p.logger.Printf("Mixxx: Error getting user home directory: %v\n", err)
		return fmt.Errorf("Mixxx: could not get user home directory: %w", err)
	}
	p.logger.Printf("Mixxx: Home directory: %s\n", homeDir)

	dbPath, err := getMixxxDBPath(homeDir)
	if err != nil {
		p.logger.Printf("Mixxx: Error getting DB path: %v\n", err)
		return fmt.Errorf("Mixxx: error getting DB path: %w", err)
	}
	p.logger.Printf("Mixxx: Database path: %s\n", dbPath)

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		p.logger.Println("Mixxx: Database file does not exist, skipping poll")
		return nil
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		p.logger.Printf("Mixxx: Failed to open database: %v\n", err)
		return fmt.Errorf("Mixxx: failed to open database: %w", err)
	}
	defer db.Close()
	p.logger.Println("Mixxx: Database opened successfully")

	query := `
        SELECT li.artist, li.title 
        FROM PlaylistTracks pt
        JOIN library li ON li.id = pt.track_id
        ORDER BY pt.pl_datetime_added DESC
        LIMIT 1`
	p.logger.Println("Mixxx: Executing query for latest track...")

	row := db.QueryRow(query)
	var artist, title sql.NullString
	if err := row.Scan(&artist, &title); err != nil {
		if err == sql.ErrNoRows {
			p.logger.Println("Mixxx: No tracks found in playlist")
			return nil
		}
		p.logger.Printf("Mixxx: Failed to query database: %v\n", err)
		return fmt.Errorf("Mixxx: failed to query database: %w", err)
	}

	trackDetails := TrackDetails{
		Artist: strings.ToUpper(artist.String),
		Track:  strings.ToUpper(title.String),
		Time:   time.Now(),
	}
	p.logger.Printf("Mixxx: Found track - Artist: '%s', Track: '%s'\n", trackDetails.Artist, trackDetails.Track)

	if p.isNewTrack(trackDetails) {
		p.logger.Printf("Mixxx: New track detected! Broadcasting...\n")
		p.BroadcastMessage(trackDetails)
		p.trackChan <- trackDetails
	} else {
		p.logger.Println("Mixxx: Track is same as last, not broadcasting")
	}

	p.logger.Println("Mixxx: Poll completed successfully")
	return nil
}

func (p *Poller) pollDJUCED() error {
	p.logger.Println("DJUCED: Starting poll...")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		p.logger.Printf("DJUCED: Error getting user home directory: %v\n", err)
		return fmt.Errorf("DJUCED: could not get user home directory: %w", err)
	}
	p.logger.Printf("DJUCED: Home directory: %s\n", homeDir)

	dbPath, err := getDJUCEDDBPath(homeDir)
	if err != nil {
		p.logger.Printf("DJUCED: Error getting DB path: %v\n", err)
		return fmt.Errorf("DJUCED: error getting DB path: %w", err)
	}
	p.logger.Printf("DJUCED: Database path: %s\n", dbPath)

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		p.logger.Println("DJUCED: Database file does not exist, skipping poll")
		return nil
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		p.logger.Printf("DJUCED: Failed to open database: %v\n", err)
		return fmt.Errorf("DJUCED: failed to open database: %w", err)
	}
	defer db.Close()
	p.logger.Println("DJUCED: Database opened successfully")

	query := `SELECT artist, title FROM tracks WHERE last_played IS NOT NULL ORDER BY last_played DESC LIMIT 1`
	p.logger.Println("DJUCED: Executing query for latest played track...")

	row := db.QueryRow(query)
	var artist, title sql.NullString
	if err := row.Scan(&artist, &title); err != nil {
		if err == sql.ErrNoRows {
			p.logger.Println("DJUCED: No tracks with last_played found")
			return nil
		}
		p.logger.Printf("DJUCED: Failed to query database: %v\n", err)
		return fmt.Errorf("DJUCED: failed to query database: %w", err)
	}

	trackDetails := TrackDetails{
		Artist: strings.ToUpper(artist.String),
		Track:  strings.ToUpper(title.String),
		Time:   time.Now(),
	}
	p.logger.Printf("DJUCED: Found track - Artist: '%s', Track: '%s'\n", trackDetails.Artist, trackDetails.Track)

	if p.isNewTrack(trackDetails) {
		p.logger.Printf("DJUCED: New track detected! Broadcasting...\n")
		p.BroadcastMessage(trackDetails)
		p.trackChan <- trackDetails
	} else {
		p.logger.Println("DJUCED: Track is same as last, not broadcasting")
	}

	p.logger.Println("DJUCED: Poll completed successfully")
	return nil
}

func (p *Poller) pollDjayPro() error {
	p.logger.Println("djayPro: Starting poll...")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		p.logger.Printf("djayPro: Error getting user home directory: %v\n", err)
		return fmt.Errorf("djayPro: could not get user home directory: %w", err)
	}
	filePath := filepath.Join(homeDir, "Music", "djay", "djay Media Library.djayMediaLibrary", "NowPlaying.txt")
	p.logger.Printf("djayPro: Looking for NowPlaying.txt at: %s\n", filePath)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		p.logger.Println("djayPro: NowPlaying.txt file does not exist, skipping poll")
		return nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		p.logger.Printf("djayPro: Error reading NowPlaying.txt: %v\n", err)
		return err
	}
	p.logger.Printf("djayPro: Read %d bytes from NowPlaying.txt\n", len(data))

	lines := strings.Split(string(data), "\n")
	details := TrackDetails{Time: time.Now()}
	p.logger.Printf("djayPro: Parsing %d lines from file\n", len(lines))

	for _, line := range lines {
		if strings.HasPrefix(line, "Title: ") {
			details.Track = strings.TrimSpace(strings.TrimPrefix(line, "Title: "))
			p.logger.Printf("djayPro: Found title: '%s'\n", details.Track)
		} else if strings.HasPrefix(line, "Artist: ") {
			details.Artist = strings.TrimSpace(strings.TrimPrefix(line, "Artist: "))
			p.logger.Printf("djayPro: Found artist: '%s'\n", details.Artist)
		}
	}

	if details.Artist != "" || details.Track != "" {
		p.logger.Printf("djayPro: Parsed track - Artist: '%s', Track: '%s'\n", details.Artist, details.Track)
		if p.isNewTrack(details) {
			p.logger.Printf("djayPro: New track detected! Broadcasting...\n")
			p.BroadcastMessage(details)
			p.trackChan <- details
		} else {
			p.logger.Println("djayPro: Track is same as last, not broadcasting")
		}
	} else {
		p.logger.Println("djayPro: No artist or track found in file")
	}

	p.logger.Println("djayPro: Poll completed successfully")
	return nil
}

func (p *Poller) handleVirtualDJDeckLoaded(w http.ResponseWriter, r *http.Request) {
	p.logger.Printf("VirtualDJ: Received deck loaded request from %s\n", r.RemoteAddr)

	if r.Method != http.MethodPost {
		p.logger.Printf("VirtualDJ: Invalid method %s, expected POST\n", r.Method)
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}
	var data struct {
		Deck   interface{} `json:"deck"`
		Artist string      `json:"artist"`
		Title  string      `json:"title"`
		Remix  string      `json:"remix"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		p.logger.Printf("VirtualDJ: Error decoding JSON: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var deckStr string
	switch v := data.Deck.(type) {
	case string:
		deckStr = v
	case float64:
		deckStr = fmt.Sprintf("%.0f", v)
	case json.Number:
		deckStr = v.String()
	default:
		p.logger.Printf("VirtualDJ: Invalid type for deck: %T\n", v)
		http.Error(w, "Invalid type for deck field", http.StatusBadRequest)
		return
	}

	p.logger.Printf("VirtualDJ: Deck %s loaded - Artist: '%s', Title: '%s', Remix: '%s'\n",
		deckStr, data.Artist, data.Title, data.Remix)

	p.virtualDJDecksMu.Lock()
	p.virtualDJDecks[deckStr] = TrackDetails{
		Artist: data.Artist,
		Track:  data.Title,
		Remix:  data.Remix,
	}
	p.virtualDJDecksMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Deck loaded successfully."})
	p.logger.Printf("VirtualDJ: Deck %s loaded successfully\n", deckStr)
}

func (p *Poller) handleVirtualDJActiveDeck(w http.ResponseWriter, r *http.Request) {
	p.logger.Printf("VirtualDJ: Received active deck request from %s\n", r.RemoteAddr)

	if r.Method != http.MethodPost {
		p.logger.Printf("VirtualDJ: Invalid method %s, expected POST\n", r.Method)
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}
	var data struct {
		Deck interface{} `json:"deck"`
	}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		p.logger.Printf("VirtualDJ: Error decoding JSON: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var deckStr string
	switch v := data.Deck.(type) {
	case string:
		deckStr = v
	case float64:
		deckStr = fmt.Sprintf("%.0f", v)
	case json.Number:
		deckStr = v.String()
	default:
		p.logger.Printf("VirtualDJ: Invalid type for deck: %T\n", v)
		http.Error(w, "Invalid type for deck field", http.StatusBadRequest)
		return
	}
	p.logger.Printf("VirtualDJ: Active deck set to %s\n", deckStr)

	p.virtualDJDecksMu.Lock()
	deckDetails, ok := p.virtualDJDecks[deckStr]
	p.virtualDJDecksMu.Unlock()

	if !ok {
		p.logger.Printf("VirtualDJ: Deck %s not found in loaded decks\n", deckStr)
		http.Error(w, "Deck not found", http.StatusNotFound)
		return
	}

	trackToProcess := TrackDetails{
		Artist: deckDetails.Artist,
		Track:  deckDetails.Track,
		Remix:  deckDetails.Remix,
		Time:   time.Now(),
	}
	p.logger.Printf("VirtualDJ: Processing active deck track - Artist: '%s', Track: '%s'\n",
		trackToProcess.Artist, trackToProcess.Track)

	if p.isNewTrack(trackToProcess) {
		p.logger.Printf("VirtualDJ: New track detected on active deck! Broadcasting...\n")
		p.BroadcastMessage(trackToProcess)
		p.trackChan <- trackToProcess
	} else {
		p.logger.Println("VirtualDJ: Active deck track is same as last, not broadcasting")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Active deck recorded."})
	p.logger.Println("VirtualDJ: Active deck processed successfully")
}

func (p *Poller) _getMostLikelyPlayingTraktorDeck() *TrackDetails {
	p.traktorDecksMu.Lock()
	defer p.traktorDecksMu.Unlock()

	var mostLikelyPlayingDeck *TrackDetails
	highestScore := -1.0
	p.logger.Println("Traktor: Calculating most likely playing deck...")

	if len(p.traktorDecks) == 0 {
		p.logger.Println("Traktor: No decks loaded, cannot determine most likely playing deck.")
		return nil
	}

	for deckKey, deckDetails := range p.traktorDecks {
		if deckDetails == nil {
			p.logger.Printf("Traktor: Deck %s details are nil, skipping\n", deckKey)
			continue
		}
		if !deckDetails.IsPlaying {
			p.logger.Printf("Traktor: Deck %s is not playing (IsPlaying: %v), skipping calculation for this deck\n", deckKey, deckDetails.IsPlaying)
			continue
		}

		score := 0.0
		xfaderAdjust := deckDetails.PropXfaderAdjust
		if xfaderAdjust < 0 {
			xfaderAdjust = 0
		} else if xfaderAdjust > 1 {
			xfaderAdjust = 1
		}

		if deckKey == "A" || deckKey == "C" {
			score = deckDetails.PropVolume * (1 - xfaderAdjust)
		} else if deckKey == "B" || deckKey == "D" {
			score = deckDetails.PropVolume * xfaderAdjust
		} else {
			p.logger.Printf("Traktor: Unknown deck key %s, skipping score calculation\n", deckKey)
			continue
		}
		p.logger.Printf("Traktor: Deck %s - IsPlaying: %v, Volume: %.3f, XfaderAdjust: %.3f, Calculated Score: %.3f\n",
			deckKey, deckDetails.IsPlaying, deckDetails.PropVolume, xfaderAdjust, score)

		if score > highestScore {
			highestScore = score
			tempDeckDetails := *deckDetails
			mostLikelyPlayingDeck = &tempDeckDetails
			p.logger.Printf("Traktor: New highest score deck: %s (Artist: '%s', Track: '%s') with score %.3f\n",
				deckKey, mostLikelyPlayingDeck.Artist, mostLikelyPlayingDeck.Track, highestScore)
		}
	}

	if mostLikelyPlayingDeck != nil {
		p.logger.Printf("Traktor: Most likely playing deck determined: Artist: '%s', Track: '%s', Score: %.3f\n",
			mostLikelyPlayingDeck.Artist, mostLikelyPlayingDeck.Track, highestScore)
	} else {
		p.logger.Println("Traktor: No playing deck found or all playing decks have zero score.")
	}
	return mostLikelyPlayingDeck
}

func (p *Poller) handleTraktorDeckLoaded(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		p.logger.Println("Traktor: Received OPTIONS request for /deckLoaded")
		w.WriteHeader(http.StatusOK)
		return
	}

	p.logger.Printf("Traktor: Received /deckLoaded request from %s, Method: %s\n", r.RemoteAddr, r.Method)

	if r.Method != http.MethodPost {
		p.logger.Printf("Traktor: Invalid method %s for /deckLoaded, expected POST\n", r.Method)
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}
	var data struct {
		Deck             string  `json:"deck"`
		Artist           string  `json:"artist"`
		Title            string  `json:"title"`
		Date             string  `json:"date"`
		Label            string  `json:"label"`
		Remixer          string  `json:"remixer"`
		PropXfaderAdjust float64 `json:"propXfaderAdjust"`
		PropVolume       float64 `json:"propVolume"`
		IsPlaying        bool    `json:"isPlaying"`
	}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		p.logger.Printf("Traktor: Error reading body for /deckLoaded: %v\n", err)
		http.Error(w, "Error reading request body", http.StatusInternalServerError)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		p.logger.Printf("Traktor: Error decoding JSON for /deckLoaded: %v. Body: %s\n", err, string(bodyBytes))
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	p.logger.Printf("Traktor: /deckLoaded decoded data - Deck: %s, Artist: '%s', Title: '%s', Date: '%s', Label: '%s', Remixer: '%s', IsPlaying: %v, Volume: %.3f, Xfader: %.3f\n",
		data.Deck, data.Artist, data.Title, data.Date, data.Label, data.Remixer, data.IsPlaying, data.PropVolume, data.PropXfaderAdjust)

	if data.Deck == "" || !strings.ContainsAny(data.Deck, "ABCD") || len(data.Deck) != 1 {
		p.logger.Printf("Traktor: Invalid 'deck' parameter in /deckLoaded: '%s'. Must be A, B, C, or D.\n", data.Deck)
		http.Error(w, "Invalid or missing 'deck' parameter. Must be A, B, C, or D.", http.StatusBadRequest)
		return
	}

	p.traktorDecksMu.Lock()
	p.traktorDecks[data.Deck] = &TrackDetails{
		Artist:           data.Artist,
		Track:            data.Title,
		DateAdded:        data.Date,
		Label:            data.Label,
		Remix:            data.Remixer,
		PropVolume:       data.PropVolume,
		PropXfaderAdjust: data.PropXfaderAdjust,
		IsPlaying:        data.IsPlaying,
		Time:             time.Now(),
	}
	p.logger.Printf("Traktor: Stored deck %s in memory. Current deck states: %+v\n", data.Deck, p.traktorDecks)
	p.traktorDecksMu.Unlock()

	activeTrack := p._getMostLikelyPlayingTraktorDeck()
	if activeTrack != nil {

		broadcastTrack := TrackDetails{
			Artist:  activeTrack.Artist,
			Track:   activeTrack.Track,
			Label:   activeTrack.Label,
			Remix:   activeTrack.Remix,
			Time:    activeTrack.Time,
			Artwork: activeTrack.Artwork,
			BPM:     activeTrack.BPM,
			Key:     activeTrack.Key,
		}
		p.logger.Printf("Traktor: /deckLoaded - Active track identified: Artist: '%s', Track: '%s'\n",
			broadcastTrack.Artist, broadcastTrack.Track)

		if p.isNewTrack(broadcastTrack) {
			p.logger.Printf("Traktor: /deckLoaded - New track detected! Broadcasting: Artist: '%s', Track: '%s'\n", broadcastTrack.Artist, broadcastTrack.Track)
			p.BroadcastMessage(broadcastTrack)
			p.trackChan <- broadcastTrack
		} else {
			p.logger.Printf("Traktor: /deckLoaded - Track is same as last (Artist: '%s', Track: '%s'), not broadcasting.\n", broadcastTrack.Artist, broadcastTrack.Track)
		}
	} else {
		p.logger.Println("Traktor: /deckLoaded - No active track identified after loading.")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Deck loaded successfully."})
	p.logger.Printf("Traktor: /deckLoaded response sent for deck %s\n", data.Deck)
}

func (p *Poller) handleTraktorLog(w http.ResponseWriter, r *http.Request) {
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		p.logger.Printf("Traktor: Error reading body for /log: %v\n", err)
		http.Error(w, "Error reading request body", http.StatusInternalServerError)
		return
	}
	p.logger.Printf("Traktor: /log received body: %s\n", string(bodyBytes))
}

func (p *Poller) handleTraktorUpdateDeck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		p.logger.Println("Traktor: Received OPTIONS request for /updateDeck")
		w.WriteHeader(http.StatusOK)
		return
	}

	p.logger.Printf("Traktor: Received /updateDeck request from %s, Method: %s\n", r.RemoteAddr, r.Method)

	if r.Method != http.MethodPost {
		p.logger.Printf("Traktor: Invalid method %s for /updateDeck, expected POST\n", r.Method)
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}
	var data struct {
		Deck             string  `json:"deck"`
		PropVolume       float64 `json:"propVolume"`
		PropXfaderAdjust float64 `json:"propXfaderAdjust"`
		IsPlaying        bool    `json:"isPlaying"`
	}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		p.logger.Printf("Traktor: Error reading body for /updateDeck: %v\n", err)
		http.Error(w, "Error reading request body", http.StatusInternalServerError)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		p.logger.Printf("Traktor: Error decoding JSON for /updateDeck: %v. Body: %s\n", err, string(bodyBytes))
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	p.logger.Printf("Traktor: /updateDeck decoded data - Deck: %s, IsPlaying: %v, Volume: %.3f, Xfader: %.3f\n",
		data.Deck, data.IsPlaying, data.PropVolume, data.PropXfaderAdjust)

	if data.Deck == "" || !strings.ContainsAny(data.Deck, "ABCD") || len(data.Deck) != 1 {
		p.logger.Printf("Traktor: Invalid 'deck' parameter in /updateDeck: '%s'. Must be A, B, C, or D.\n", data.Deck)
		http.Error(w, "Invalid or missing 'deck' parameter. Must be A, B, C, or D.", http.StatusBadRequest)
		return
	}

	if (data.Deck == "A" || data.Deck == "C") && data.PropXfaderAdjust == 1.0 {
		p.logger.Printf("Traktor: /updateDeck - Deck %s (left deck) xfader is fully to the right (1.0). IsPlaying: %v, Volume: %.2f\n", data.Deck, data.IsPlaying, data.PropVolume)
	}
	if (data.Deck == "B" || data.Deck == "D") && data.PropXfaderAdjust == 0.0 {
		p.logger.Printf("Traktor: /updateDeck - Deck %s (right deck) xfader is fully to the left (0.0). IsPlaying: %v, Volume: %.2f\n", data.Deck, data.IsPlaying, data.PropVolume)
	}

	p.traktorDecksMu.Lock()
	deckState, exists := p.traktorDecks[data.Deck]
	if !exists || deckState == nil {
		p.traktorDecksMu.Unlock()
		p.logger.Printf("Traktor: /updateDeck - Deck %s not loaded yet. Send /deckLoaded first.\n", data.Deck)
		http.Error(w, "Deck "+data.Deck+" not loaded. Send /deckLoaded first.", http.StatusPreconditionFailed)
		return
	}

	deckState.PropVolume = data.PropVolume
	deckState.PropXfaderAdjust = data.PropXfaderAdjust
	deckState.IsPlaying = data.IsPlaying
	deckState.Time = time.Now()

	p.logger.Printf("Traktor: /updateDeck - Updated deck %s state. New state: IsPlaying: %v, Volume: %.3f, Xfader: %.3f. Current deck states: %+v\n",
		data.Deck, deckState.IsPlaying, deckState.PropVolume, deckState.PropXfaderAdjust, p.traktorDecks)
	p.traktorDecksMu.Unlock()

	activeTrack := p._getMostLikelyPlayingTraktorDeck()
	if activeTrack != nil {

		broadcastTrack := TrackDetails{
			Artist:  activeTrack.Artist,
			Track:   activeTrack.Track,
			Label:   activeTrack.Label,
			Remix:   activeTrack.Remix,
			Time:    activeTrack.Time,
			Artwork: activeTrack.Artwork,
			BPM:     activeTrack.BPM,
			Key:     activeTrack.Key,
		}
		p.logger.Printf("Traktor: /updateDeck - Active track identified after update: Artist: '%s', Track: '%s'\n",
			broadcastTrack.Artist, broadcastTrack.Track)

		if p.isNewTrack(broadcastTrack) {
			p.logger.Printf("Traktor: /updateDeck - New track detected after update! Broadcasting: Artist: '%s', Track: '%s'\n", broadcastTrack.Artist, broadcastTrack.Track)
			p.BroadcastMessage(broadcastTrack)
			p.trackChan <- broadcastTrack
		} else {
			p.logger.Printf("Traktor: /updateDeck - Track is same as last (Artist: '%s', Track: '%s'), not broadcasting.\n", broadcastTrack.Artist, broadcastTrack.Track)
		}
	} else {
		p.logger.Println("Traktor: /updateDeck - No active track identified after update.")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Deck updated successfully."})
	p.logger.Printf("Traktor: /updateDeck response sent for deck %s\n", data.Deck)
}

func (m *Model) startStagelinQ() {
	m.logger.Println("Denon/StagelinQ: Starting StagelinQ listener...")

	listener, err := stagelinq.ListenWithConfiguration(&stagelinq.ListenerConfiguration{
		DiscoveryTimeout: 5 * time.Second,
		Name:             "Unbox",
		SoftwareName:     "Unbox",
		SoftwareVersion:  "1.0.0",
	})

	if err != nil {
		m.logger.Printf("Denon/StagelinQ: Failed to start listener: %v\n", err)
		m.trackChan <- TrackDetails{
			Artist: "Error",
			Track:  fmt.Sprintf("Failed to start StagelinQ: %v", err),
			Time:   time.Now(),
		}
		return
	}

	m.stagelinqListener = listener
	m.logger.Println("Denon/StagelinQ: Listener started successfully")

	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if m.stagelinqListener != nil {
					m.stagelinqListener.AnnounceEvery(time.Second)
				} else {
					return
				}
			case <-m.ctx.Done():
				m.logger.Println("Denon/StagelinQ: Announcement loop stopped (context done)")
				return
			}
		}
	}()

	go m.discoverStagelinQDevices()
}

func (m *Model) discoverStagelinQDevices() {
	m.logger.Println("Denon/StagelinQ: Starting device discovery...")

	for {
		select {
		case <-m.ctx.Done():
			m.logger.Println("Denon/StagelinQ: Discovery loop stopped (context done)")
			return
		default:
		}

		m.logger.Println("Denon/StagelinQ: Discovering devices (5s timeout)...")
		device, deviceState, err := m.stagelinqListener.Discover(5 * time.Second)
		if err != nil {
			if !strings.Contains(err.Error(), "timeout") {
				m.logger.Printf("Denon/StagelinQ: Discovery error: %v\n", err)
				m.trackChan <- TrackDetails{
					Artist: "Discovery Error",
					Track:  err.Error(),
					Time:   time.Now(),
				}
			}
			continue
		}

		if device == nil {
			continue
		}

		m.logger.Printf("Denon/StagelinQ: Device discovered - Name: %s, IP: %s, State: %v\n",
			device.Name, device.IP.String(), deviceState)

		if deviceState != stagelinq.DevicePresent {
			m.logger.Printf("Denon/StagelinQ: Device %s not present, skipping\n", device.Name)
			continue
		}

		m.stagelinqMu.Lock()
		deviceID := device.IP.String()
		if _, exists := m.stagelinqDevices[deviceID]; exists {
			m.stagelinqMu.Unlock()
			m.logger.Printf("Denon/StagelinQ: Device %s already connected, skipping\n", device.Name)
			continue
		}
		m.stagelinqDevices[deviceID] = device
		m.stagelinqMu.Unlock()

		m.logger.Printf("Denon/StagelinQ: New device %s, connecting...\n", device.Name)
		go m.connectToStagelinQDevice(device, deviceState)
	}
}

func (m *Model) connectToStagelinQDevice(device *stagelinq.Device, deviceState stagelinq.DeviceState) {
	m.logger.Printf("Denon/StagelinQ: Connecting to device %s at %s\n", device.Name, device.IP.String())

	deviceConn, err := device.Connect(m.stagelinqListener.Token(), []*stagelinq.Service{})
	if err != nil {
		m.logger.Printf("Denon/StagelinQ: Failed to connect to %s: %v\n", device.Name, err)
		m.trackChan <- TrackDetails{
			Artist: "Connection Error",
			Track:  fmt.Sprintf("Failed to connect to %s: %v", device.Name, err),
			Time:   time.Now(),
		}
		return
	}
	defer deviceConn.Close()
	m.logger.Printf("Denon/StagelinQ: Connected to device %s\n", device.Name)

	m.logger.Printf("Denon/StagelinQ: Requesting services from %s\n", device.Name)
	services, err := deviceConn.RequestServices()
	if err != nil {
		m.logger.Printf("Denon/StagelinQ: Failed to request services from %s: %v\n", device.Name, err)
		return
	}
	m.logger.Printf("Denon/StagelinQ: Received %d services from %s\n", len(services), device.Name)

	var stateMapPort uint16
	for _, service := range services {
		m.logger.Printf("Denon/StagelinQ: Service found - Name: %s, Port: %d\n", service.Name, service.Port)
		if service.Name == "StateMap" {
			stateMapPort = service.Port
			break
		}
	}

	if stateMapPort == 0 {
		m.logger.Printf("Denon/StagelinQ: StateMap service not found on %s\n", device.Name)
		return
	}
	m.logger.Printf("Denon/StagelinQ: StateMap service found on port %d\n", stateMapPort)

	m.logger.Printf("Denon/StagelinQ: Dialing StateMap service on %s:%d\n", device.IP.String(), stateMapPort)
	stateMapTCPConn, err := device.Dial(stateMapPort)
	if err != nil {
		m.logger.Printf("Denon/StagelinQ: Failed to dial StateMap service: %v\n", err)
		return
	}
	defer stateMapTCPConn.Close()

	stateMapConn, err := stagelinq.NewStateMapConnection(stateMapTCPConn, m.stagelinqListener.Token())
	if err != nil {
		m.logger.Printf("Denon/StagelinQ: Failed to create StateMap connection: %v\n", err)
		return
	}
	m.logger.Println("Denon/StagelinQ: StateMap connection established")

	trackStates := []string{
		stagelinq.EngineDeck1.TrackTrackName(),
		stagelinq.EngineDeck1.TrackArtistName(),
		stagelinq.EngineDeck1.TrackSongName(),
		stagelinq.EngineDeck1.Play(),
		stagelinq.EngineDeck1.PlayState(),
		stagelinq.EngineDeck1.TrackSongLoaded(),
		stagelinq.EngineDeck2.TrackTrackName(),
		stagelinq.EngineDeck2.TrackArtistName(),
		stagelinq.EngineDeck2.TrackSongName(),
		stagelinq.EngineDeck2.Play(),
		stagelinq.EngineDeck2.PlayState(),
		stagelinq.EngineDeck2.TrackSongLoaded(),
		stagelinq.EngineDeck3.TrackTrackName(),
		stagelinq.EngineDeck3.TrackArtistName(),
		stagelinq.EngineDeck3.TrackSongName(),
		stagelinq.EngineDeck3.Play(),
		stagelinq.EngineDeck3.PlayState(),
		stagelinq.EngineDeck3.TrackSongLoaded(),
		stagelinq.EngineDeck4.TrackTrackName(),
		stagelinq.EngineDeck4.TrackArtistName(),
		stagelinq.EngineDeck4.TrackSongName(),
		stagelinq.EngineDeck4.Play(),
		stagelinq.EngineDeck4.PlayState(),
		stagelinq.EngineDeck4.TrackSongLoaded(),
	}

	m.logger.Printf("Denon/StagelinQ: Subscribing to %d state changes\n", len(trackStates))
	for _, state := range trackStates {
		stateMapConn.Subscribe(state)
	}
	m.logger.Println("Denon/StagelinQ: Subscribed to all track states")

	type deckState struct {
		artist     string
		track      string
		songName   string
		isPlaying  bool
		songLoaded bool
	}
	deckStates := make(map[int]*deckState)
	lastReportedTrack := make(map[int]string)

	for i := 1; i <= 4; i++ {
		deckStates[i] = &deckState{}
	}
	m.logger.Println("Denon/StagelinQ: Initialized deck states for 4 decks")

	m.logger.Printf("Denon/StagelinQ: Listening for state changes from %s\n", device.Name)
	for {
		select {
		case state := <-stateMapConn.StateC():
			var deckNum int
			if strings.Contains(state.Name, "/Deck1/") {
				deckNum = 1
			} else if strings.Contains(state.Name, "/Deck2/") {
				deckNum = 2
			} else if strings.Contains(state.Name, "/Deck3/") {
				deckNum = 3
			} else if strings.Contains(state.Name, "/Deck4/") {
				deckNum = 4
			} else {
				continue
			}

			m.logger.Printf("Denon/StagelinQ: State change on deck %d - %s\n", deckNum, state.Name)
			deck := deckStates[deckNum]

			switch {
			case strings.HasSuffix(state.Name, "/TrackName"):
				if val, ok := state.Value["string"]; ok {
					if title, ok := val.(string); ok {
						deck.track = strings.ToUpper(title)
						m.logger.Printf("Denon/StagelinQ: Deck %d track name: '%s'\n", deckNum, deck.track)
					}
				}
			case strings.HasSuffix(state.Name, "/ArtistName"):
				if val, ok := state.Value["string"]; ok {
					if artist, ok := val.(string); ok {
						deck.artist = strings.ToUpper(artist)
						m.logger.Printf("Denon/StagelinQ: Deck %d artist name: '%s'\n", deckNum, deck.artist)
					}
				}
			case strings.HasSuffix(state.Name, "/SongName"):
				if val, ok := state.Value["string"]; ok {
					if songName, ok := val.(string); ok {
						deck.songName = songName
						m.logger.Printf("Denon/StagelinQ: Deck %d song name: '%s'\n", deckNum, deck.songName)
					}
				}
			case strings.HasSuffix(state.Name, "/Play"):
				if val, ok := state.Value["state"]; ok {
					if playing, ok := val.(bool); ok {
						deck.isPlaying = playing
						m.logger.Printf("Denon/StagelinQ: Deck %d play state: %v\n", deckNum, deck.isPlaying)
					}
				}
			case strings.HasSuffix(state.Name, "/PlayState"):
				if val, ok := state.Value["value"]; ok {
					if playState, ok := val.(float64); ok {
						deck.isPlaying = (playState == 1)
						m.logger.Printf("Denon/StagelinQ: Deck %d play state value: %.0f (playing: %v)\n",
							deckNum, playState, deck.isPlaying)
					}
				}
			case strings.HasSuffix(state.Name, "/SongLoaded"):
				if val, ok := state.Value["state"]; ok {
					if loaded, ok := val.(bool); ok {
						deck.songLoaded = loaded
						m.logger.Printf("Denon/StagelinQ: Deck %d song loaded: %v\n", deckNum, deck.songLoaded)
					}
				}
			}

			if deck.songLoaded && deck.isPlaying && deck.artist != "" && deck.track != "" {
				trackKey := fmt.Sprintf("%s - %s", deck.artist, deck.track)
				m.logger.Printf("Denon/StagelinQ: Deck %d ready to report - %s\n", deckNum, trackKey)

				if lastReportedTrack[deckNum] != trackKey {
					lastReportedTrack[deckNum] = trackKey
					m.logger.Printf("Denon/StagelinQ: New track on deck %d! Broadcasting...\n", deckNum)

					track := TrackDetails{
						Artist: deck.artist,
						Track:  deck.track,
						Time:   time.Now(),
					}

					if m.poller != nil && m.poller.isNewTrack(track) {
						m.poller.BroadcastMessage(track)
						m.trackChan <- track
						m.logger.Printf("Denon/StagelinQ: Track broadcast complete\n")
					} else {
						m.logger.Printf("Denon/StagelinQ: Track is same as global last track, not broadcasting\n")
					}
				} else {
					m.logger.Printf("Denon/StagelinQ: Track on deck %d unchanged\n", deckNum)
				}
			}

		case err := <-stateMapConn.ErrorC():
			if err != nil {
				m.logger.Printf("Denon/StagelinQ: Connection error from %s: %v\n", device.Name, err)
				m.stagelinqMu.Lock()
				deviceID := device.IP.String()
				delete(m.stagelinqDevices, deviceID)
				m.stagelinqMu.Unlock()
				m.logger.Printf("Denon/StagelinQ: Removed device %s from connected list\n", device.Name)
				return
			}
		case <-m.ctx.Done():
			m.logger.Printf("Denon/StagelinQ: Shutting down connection to %s (context done)\n", device.Name)
			return
		}
	}
}

func (t *teeLogger) Write(p []byte) (n int, err error) {
	if t.file != nil {
		t.file.Write(p)
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	lines := strings.Split(string(p), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			*t.buffer = append(*t.buffer, line)
			if len(*t.buffer) > t.maxLines {
				*t.buffer = (*t.buffer)[len(*t.buffer)-t.maxLines:]
			}
		}
	}

	return len(p), nil
}

func (m *Model) updateLogViewport() {
	m.logBufferMu.Lock()
	defer m.logBufferMu.Unlock()

	content := strings.Join(m.logBuffer, "\n")
	m.logViewport.SetContent(content)
}

func (m *Model) renderLogView() string {
	var s strings.Builder

	s.WriteString(titleStyle.Render("unbox - Logs") + "\n\n")

	if m.isRunning {
		s.WriteString(fmt.Sprintf("Mode: %s %s\n", m.spinner.View(), selectedStyle.Render(string(m.mode))))
	} else {
		s.WriteString(fmt.Sprintf("Mode: %s (stopped)\n", selectedStyle.Render(string(m.mode))))
	}

	s.WriteString("\n")
	s.WriteString(m.logViewport.View())
	s.WriteString("\n\n")

	helpText := "↑/↓: Scroll | g: Top | G: Bottom | l/Esc: Back | q: Quit"
	s.WriteString(helpStyle.Render(helpText))

	return s.String()
}

type teeLogger struct {
	file     io.Writer
	buffer   *[]string
	mu       *sync.Mutex
	maxLines int
	model    *Model
}

func main() {
	modelInstance := initialModel(nil)

	teeLog := &teeLogger{
		file:     nil,
		buffer:   &modelInstance.logBuffer,
		mu:       &modelInstance.logBufferMu,
		maxLines: modelInstance.maxLogLines,
		model:    &modelInstance,
	}

	logger := log.New(teeLog, "", log.Ldate|log.Ltime|log.Lshortfile)
	modelInstance.logger = logger

	logger.Println("Application starting...")

	p := tea.NewProgram(&modelInstance, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		logger.Printf("Error running program: %v", err)
		fmt.Printf("Error running program: %v", err)
		os.Exit(1)
	}
	logger.Println("Application exited normally.")
}
